const express = require('express');
const router = express.Router()
const dbPool = require('./dbPoolPromise');

const validMonthRegExp = /\d{4}\-\d{2}/;
const validYearRegExp = /\d{4}/;

router.get('/', async function (req, res, next) {
    if (!req.session.userInfo) res.redirect("/");
        else res.status(200).render('review', { reviewType: "Month", subPeriod: "Day", period: undefined, category: null, expenditure: null, status: null, notification: null });
});

router.post('/', async function (req, res, next) {
    if (!req.session.userInfo) res.redirect("/");
    else {
        const username = req.session.userInfo;
        const month = req.body.month;
        const category = req.body.category ?? "All";

        const [allCateg] = await dbPool.query(`SELECT category_name FROM category UNION SELECT category_name FROM category_custom WHERE username='${username}'`);
        const validCateg = category === "All" ? true : allCateg.map((entry) => entry.category_name).includes(category) ? true : false;
        const validMonth = month ? validMonthRegExp.test(month) : false;

        if (validCateg && validMonth) {
            try {
                const [monthRecords] = await dbPool.query(`SELECT record_data,record_date FROM records WHERE username='${username}' AND YEAR(record_date)=YEAR('${month}-01') AND MONTH(record_date)=MONTH('${month}-01')`);
                if (category !== "All") {
                    const monthlyCategAnalysis = monthRecords.reduce((monthCategTally, { record_data: dailyRecord, record_date }) => {
                        const date = Number.parseInt(record_date.toLocaleDateString('sv').slice(-2)).toString();
                        //if slice to just day, the placement will be all over the place... so convert to num then back to string again, at least this solves that
                        const [categEntry] = dailyRecord.filter(({ category: categ }) => categ === category);
                        if (categEntry) {
                            delete categEntry.category;
                            monthCategTally.total += categEntry.spent;
                            monthCategTally.periodBreakdown[date] = categEntry;
                        }
                        return monthCategTally;
                    }, { total: 0, periodBreakdown: {}, __proto__: null });
                    res.status(200).render('review', { reviewType: "Month", subPeriod: "Day", period: month, category: category, expenditure: monthlyCategAnalysis, status: null, notification: null });
                    console.log(category, "-->", monthlyCategAnalysis);
                }
                else {
                    const monthlyAnalysis = monthRecords.reduce((monthTally, { record_data: dailyRecord, record_date }) => {
                        const date = Number.parseInt(record_date.toLocaleDateString('sv').slice(-2)).toString();
                        const dayAnalysis = dailyRecord.reduce((dayTally, eachDayCateg) => {
                            // console.log(date, " -->", eachDayCateg) //
                            dayTally.totalPerCateg[eachDayCateg.category] = eachDayCateg.spent;
                            dayTally.total += eachDayCateg.spent;
                            dayTally.dailyRecordsSortedByCateg[eachDayCateg.category] = [{ period: date, spent: eachDayCateg.spent, comment: eachDayCateg.comment }];
                            return { ...dayTally };
                        }, { total: 0, totalPerCateg: {}, dailyRecordsSortedByCateg: {}, __proto__: null });
                        // console.log("Day ", date, dayAnalysis); //
                        monthTally.total.grand += dayAnalysis.total; //total
                        monthTally.total.period[date] = dayAnalysis.total; //total
                        for (const [categ, spent] of Object.entries(dayAnalysis.totalPerCateg)) {
                            if (!monthTally.categList.has(categ)) {
                                monthTally.categList.add(categ);
                                monthTally.total.category[categ] = spent; //total
                            }
                            else monthTally.total.category[categ] += spent; //total
                        }
                        for (const [categ, recordEntry] of Object.entries(dayAnalysis.dailyRecordsSortedByCateg)) {
                            if (!Object.hasOwn(monthTally.categoryBreakdown, categ)) monthTally.categoryBreakdown[categ] = recordEntry;
                            else monthTally.categoryBreakdown[categ].push(...recordEntry);
                        }
                        monthTally.periodBreakdown[date] = dailyRecord; //breakdown, for day<->eachCateg sort
                        return monthTally;
                    }, { total: { grand: 0, category: {}, period: {} }, categoryBreakdown: {}, periodBreakdown: {}, categList: new Set(), __proto__: null });
                    // console.log("Monthly", monthlyAnalysis) //
                    res.status(200).render('review', { reviewType: "Month", subPeriod: "Day", period: month, category: "All", expenditure: monthlyAnalysis, status: null, notification: null });
                    console.log("All", "-->", monthlyAnalysis);
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        else res.status(400).render('review', { reviewType: "Month", subPeriod: "Day", period: undefined, category: null, expenditure: null, status: "Fail", notification: {title:"Invalid",message:"Invalid criteria submitted!"} });
    }
});

router.get('/year', async function (req, res, next) {
    if (!req.session.userInfo) res.redirect("/");
    else res.status(200).render('review', { reviewType: "Year", subPeriod: "Month", period: undefined, category: null, expenditure: null, status: null, notification: null });
})

router.post('/year', async function (req, res, next) {
    if (!req.session.userInfo) res.redirect("/");
    else {
        const username = req.session.userInfo;
        const yearFrom = req.body.yearFrom;
        const yearTo = req.body.yearTo ?? req.body.yearFrom;
        const category = req.body.category ?? "All";

        const [allCateg] = await dbPool.query(`SELECT category_name FROM category UNION SELECT category_name FROM category_custom WHERE username='${username}'`);
        const validCateg = category === "All" ? true : allCateg.map((entry) => entry.category_name).includes(category) ? true : false;
        const validFrom = yearFrom ? validYearRegExp.test(yearFrom) : false;
        const validTo = yearTo ? validYearRegExp.test(yearTo) : false;
        const sameYear = yearFrom === yearTo;
        const rangeErr = yearFrom > yearTo;
        const validYear = validFrom && validTo && (yearTo >= yearFrom);

        const monthKey = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const yearKey = [...{
            [Symbol.iterator]: function* () {
                for (let year = Number.parseInt(yearFrom); year <= yearTo; year++) {
                    yield year.toString();
                }
            }
        }];
        const keySet = sameYear ? monthKey : yearKey;

        if (validCateg && validYear) {
            try {
                const [periodRecords] = await dbPool.query(`SELECT record_data,record_date FROM records WHERE username='${username}' AND YEAR(record_date)>=YEAR('${yearFrom}-01-01') AND YEAR(record_date)<=YEAR('${yearTo}-01-01')`);

                if (category !== "All") {
                    const periodBreakdownInitial = keySet.reduce((obj, key) => {
                        obj[key] = { spent: 0 };
                        return obj;
                    }, {});

                    const periodCategAnalysis = periodRecords.reduce((periodCategTally, { record_data: dailyRecord, record_date }) => {
                        const ISODate = record_date.toLocaleDateString('sv');
                        const textDate = record_date.toDateString();
                        const time = sameYear ? textDate.slice(4, 7) : ISODate.slice(0, 4);

                        const [categEntry] = dailyRecord.filter(({ category: categ }) => categ === category);
                        //only one object each day for a specific categ
                        if (categEntry) {
                            periodCategTally.total += categEntry.spent;
                            periodCategTally.periodBreakdown[time].spent += categEntry.spent;
                        }
                        return periodCategTally;
                    }, { total: 0, periodBreakdown: periodBreakdownInitial, __proto__: null });
                    res.status(200).render('review', { reviewType: "Year", subPeriod: sameYear ? "Month" : "Year", period: sameYear ? yearFrom : `${yearFrom}~${yearTo}`, category: category, expenditure: periodCategAnalysis, status: null, notification: null });
                    // res.status(200).send(periodCategAnalysis);
                    console.log(category, "-->", periodCategAnalysis);
                }

                else {
                    //set the structure to prevent gaps.. unlike day, doesn't seems to make sense in a yearly analysis to skip a couple of months
                    const periodTotalInitial = keySet.reduce((obj, key) => {
                        obj[key] = 0;
                        return obj;
                    }, {});

                    const periodAnalysis = periodRecords.reduce((periodTally, { record_data: dailyRecord, record_date }) => {
                        const ISODate = record_date.toLocaleDateString('sv');
                        const textDate = record_date.toDateString();
                        const time = sameYear ? textDate.slice(4, 7) : ISODate.slice(0, 4);

                        const dayData = dailyRecord.reduce((periodTally, { spent, category }) => {
                            periodTally.total += spent;
                            periodTally.totalPerCateg[category] ??= 0;
                            periodTally.totalPerCateg[category] += spent;

                            periodTally.periodRecordsSortedByCateg[category] = [{ period: time, spent: spent }];
                            return periodTally;
                        }, { total: 0, totalPerCateg: {}, periodRecordsSortedByCateg: {}, __proto__: null });

                        periodTally.total.grand += dayData.total; //total
                        // periodTally.total.period[time] ??= 0; //total, pre initial object
                        periodTally.total.period[time] += dayData.total; //total

                        for (const [categ, spent] of Object.entries(dayData.totalPerCateg)) {
                            if (!periodTally.categList.has(categ)) {
                                periodTally.categList.add(categ);
                                periodTally.total.category[categ] ??= 0;
                                periodTally.total.category[categ] += spent; //total
                            }
                            else periodTally.total.category[categ] += spent; //total
                        }
                        for (const [categ, [recordEntry]] of Object.entries(dayData.periodRecordsSortedByCateg)) {
                            const entryPeriod = recordEntry.period;
                            const entrySpent = recordEntry.spent;
                            if (!Object.hasOwn(periodTally.categoryBreakdown, categ)) {
                                periodTally.categoryBreakdown[categ] = [recordEntry];
                            }
                            // if have that categ, put that in, recordEntry is an array of objects =>[{period,spent}]
                            else {
                                const periodIndex = periodTally.categoryBreakdown[categ].findIndex(({ period }) => period === entryPeriod);
                                periodIndex === -1 ? periodTally.categoryBreakdown[categ].push(recordEntry) : periodTally.categoryBreakdown[categ][periodIndex].spent += entrySpent;
                            }
                            if (!Object.hasOwn(periodTally.periodBreakdown, entryPeriod)) {
                                periodTally.periodBreakdown[entryPeriod] = [{ spent: entrySpent, category: categ }];
                            }
                            else {
                                const categIndex = periodTally.periodBreakdown[entryPeriod].findIndex(({ category }) => category === categ);
                                categIndex === -1 ? periodTally.periodBreakdown[entryPeriod].push({ spent: entrySpent, category: categ }) : periodTally.periodBreakdown[entryPeriod][categIndex].spent += entrySpent;
                            }
                        }
                        return periodTally;
                    }, { total: { grand: 0, category: {}, period: periodTotalInitial }, categoryBreakdown: {}, periodBreakdown: {}, categList: new Set(), __proto__: null });
                    // if not using initial, swap the ~initial with empty object
                    res.status(200).render('review', { reviewType: "Year", subPeriod: sameYear ? "Month" : "Year", period: sameYear ? yearFrom : `${yearFrom}~${yearTo}`, category: "All", expenditure: periodAnalysis, status: null, notification: null });
                    // res.status(200).send(periodAnalysis);
                    console.log(periodAnalysis);
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        else res.status(400).render('review', { reviewType: "Year", subPeriod: sameYear ? "Month" : "Year", period: undefined, category: null, expenditure: null, status: rangeErr ? 'Fail' : null, notification: rangeErr ? {title:"Range Error",message:"Starting year should be smaller than ending year!"} : null });
    }
});

router.get('/recorded-years', async function (req, res, next) {
    if (!req.session.userInfo) res.status(403).send("Not Authorised");
    else {
        const username = req.session.userInfo;
        try {
            const [yearWithRecord, field] = await dbPool.query(`SELECT DISTINCT YEAR(record_date) AS years FROM records WHERE username='${username}'`);
            res.status(200).send(yearWithRecord);
        }
        catch (error) {
            console.error(error);
            res.status(400).send(error)
        }
    }
});

module.exports = router;