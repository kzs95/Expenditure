const express = require('express');
const router = express.Router()
const dbPool = require('./dbPoolPromise');

const validMonthRegExp = /\d{4}\-\d{2}/;
const validYearRegExp = /\d{4}/;

router.get('/', async function (req, res, next) {
    if (!req.session.userInfo) res.redirect("/");
    else {
        const username = req.session.userInfo;
        const month = req.query.month;
        const category = req.query.category ?? "All";

        const [allCateg] = await dbPool.query(`SELECT category_name FROM category UNION SELECT category_name FROM category_custom WHERE username='${username}'`);
        const validCateg = category === "All" ? true : allCateg.map((entry) => entry.category_name).includes(category) ? true : false;
        const validMonth = month ? validMonthRegExp.test(month) : false;

        if (validCateg && validMonth) {
            const [monthRecords] = await dbPool.query(`SELECT record_data,record_date FROM records WHERE username='${username}' AND YEAR(record_date)=YEAR('${month}-01') AND MONTH(record_date)=MONTH('${month}-01')`);
            if (category !== "All") {
                const monthlyCategAnalysis = monthRecords.reduce((monthCategTally, { record_data: dailyRecord, record_date }) => {
                    const date = record_date.toLocaleDateString('sv').slice(5);
                    const [categEntry] = dailyRecord.filter(({ category: categ }) => categ === category);
                    if (categEntry) {
                        delete categEntry.category;
                        monthCategTally.total += categEntry.spent;
                        monthCategTally.dayBreakdown[date] = categEntry;
                    }
                    return monthCategTally;
                }, { total: 0, dayBreakdown: {}, __proto__: null });
                res.status(200).render('review', { period: month, category: category, expenditure: monthlyCategAnalysis, status: null, notification: null });
                console.log(category, "-->", monthlyCategAnalysis);
            }
            else {
                const monthlyAnalysis = monthRecords.reduce((monthTally, { record_data: dailyRecord, record_date }) => {
                    const date = record_date.toLocaleDateString('sv').slice(5);
                    const dayAnalysis = dailyRecord.reduce((dayTally, eachDayCateg) => {
                        // console.log(date, " -->", eachDayCateg) //
                        dayTally.totalPerCateg[eachDayCateg.category] = eachDayCateg.spent;
                        dayTally.total += eachDayCateg.spent;
                        dayTally.dailyRecordCategKeySort[eachDayCateg.category] = [{ day: date, spent: eachDayCateg.spent, comment: eachDayCateg.comment }];
                        return { ...dayTally };
                    }, { total: 0, totalPerCateg: {}, dailyRecordCategKeySort: {}, __proto__: null });
                    // console.log("Day ", date, dayAnalysis); //
                    monthTally.total.grand += dayAnalysis.total; //total
                    monthTally.total.day[date] = dayAnalysis.total; //total
                    for (const [categ, spent] of Object.entries(dayAnalysis.totalPerCateg)) {
                        if (!monthTally.categList.has(categ)) {
                            monthTally.categList.add(categ);
                            monthTally.total.category[categ] = spent; //total
                        }
                        else monthTally.total.category[categ] += spent; //total
                    }
                    for (const [categ, recordEntry] of Object.entries(dayAnalysis.dailyRecordCategKeySort)) {
                        if (!Object.hasOwn(monthTally.categoryBreakdown, categ)) monthTally.categoryBreakdown[categ] = recordEntry;
                        else monthTally.categoryBreakdown[categ].push(...recordEntry);
                    }
                    monthTally.dayBreakdown[date] = dailyRecord; //breakdown, for day<->eachCateg sort
                    return monthTally;
                }, { total: { grand: 0, category: {}, day: {} }, categoryBreakdown: {}, dayBreakdown: {}, categList: new Set(), __proto__: null });
                // console.log("Monthly", monthlyAnalysis) //
                res.status(200).render('review', { period: month, category: "All", expenditure: monthlyAnalysis, status: null, notification: null });
                console.log("All", "-->", monthlyAnalysis);
            }
        }
        else res.status(200).render('review', { period: undefined, category: null, expenditure: null, status: null, notification: null });
    }
});

module.exports = router;