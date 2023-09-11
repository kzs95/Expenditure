const express = require('express');
const router = express.Router();
const dbPool = require('./dbPoolPromise');
const validDateRegExp = /^[0-9]{4}\-(?:0[1-9]|1[0-2])\-(?:0[1-9]|[12][0-9]|3[01])$/;
const validSpentRegExp = /^[0-9]+(\.\d{1,2})*$/;

async function dateSpentCategCommentValidator(request) {
    const username = request.session.userInfo;
    const body = request.body;
    const date = body.date;
    const spent = body.spent;
    const category = body.category;
    const comment = body.comment;

    try {
        // request data validation!
        const [allCateg] = await dbPool.query(`SELECT category_name FROM category UNION SELECT category_name FROM category_custom WHERE username='${username}'`);
        const validDate = date ? validDateRegExp.test(date) : false;
        const validSpent = spent ? validSpentRegExp.test(spent) : false;
        const validCateg = category ? allCateg.map((entry) => entry.category_name).includes(category) : false;
        const validComment = Object.hasOwn(body, "comment"); //just want to check if that property exists
        if (validDate && validSpent && validCateg && validComment) return true;
        else return false;
    }
    catch (error) {
        console.error(error);
        throw error;
    }
}

async function recordExistenceValidator(request) {
    const username = request.session.userInfo;
    const body = request.body;
    const date = body.date;
    const spent = body.spent;
    const category = body.category;
    const comment = body.comment;
    try {
        const [existence] = await dbPool.query(`SELECT JSON_CONTAINS(record_data,'{ "spent": ${spent}, "comment": "${comment}", "category": "${category}"}') AS have FROM records WHERE record_date = '${date}' AND username='${username}'`);
        return existence.length === 0 ? false : Boolean(existence[0].have);
        // If that date exists, will always 1 or 0, but if not exists is empty array!!! Remove record_date will also fix this issue!
    }
    catch (error) {
        console.error(error);
        throw error;
    }
}

router.get('/', async function (req, res) {
    if (!req.session.userInfo) {
        res.redirect("/")
    }
    else {
        const username = req.session.userInfo;
        const date = req.query.date;
        const category = req.query.category;
        const validDate = date ? validDateRegExp.test(date) : false;
        const validCateg = false;
        const validation = category && date ? validDate && validCateg : (validCateg || validDate);
        if (validation) {
            const recordIdStr = `${date}_${username}`;
            try {
                const [result, field] = await dbPool.query(`SELECT record_data FROM records WHERE record_id = '${recordIdStr}' AND username = '${username}'`);
                if (result.length === 0) res.status(200).send({ record_data: result });
                else {
                    result[0].record_data.map((categRecord) => Object.defineProperty(categRecord, "date", { value: date, enumerable: true }));
                    res.status(200).send(JSON.stringify(result[0]));
                }
            }
            catch (error) {
                console.error(error);
                throw error;
            }
        }
        else if (!validation) {
            res.status(400).render('redirect', {
                title: "No Record",
                message: `Could not retrieve spending records data!`,
                redirect: { text: "Back to Home", link: "/" },
                status: { type: "error", code: 400, text: "Bad Request" }
            });
        }
    }
});

router.post('/add', async function (req, res) {
    if (!req.session.userInfo) {
        res.redirect("/")
    }
    else {
        const username = req.session.userInfo;
        const allValid = dateSpentCategCommentValidator(req);
        if (allValid) {
            const date = req.body.day;
            const category = req.body.category;
            const spent = req.body.spent;
            const comment = req.body.comment.slice(0,100);
            const recordIdStr = `${date}_${username}`;
            const spentAmount = Number.parseFloat(spent);
            const newRecordObject = { category: category, spent: spentAmount, comment: comment};
            try {
                const [prevRecord] = await dbPool.query(`SELECT record_data FROM records WHERE record_id = '${recordIdStr}' AND username = '${username}'`);
                if (prevRecord.length !== 0) { //already exists
                    try {
                        //don't do another database query as already retrieved the while damn thing previously
                        const categRecordIdx = prevRecord[0].record_data.findIndex(({ category: categ }) => categ === category);
                        if (categRecordIdx === -1) {
                            const recordArr = prevRecord[0].record_data;
                            recordArr.push(newRecordObject);
                            const updateDB = await dbPool.query(`UPDATE records SET record_data='${JSON.stringify(recordArr)}' WHERE record_id = '${recordIdStr}' AND username ='${username}'`);
                            // const pushEntry = await dbPool.query(`UPDATE records SET record_data=JSON_ARRAY_APPEND(record_data,'$',CAST('${JSON.stringify(newRecordObject)}' AS JSON)) WHERE record_id = '${recordIdStr}' AND username ='${username}'`);
                            // Works.. but will have issue if no array... 
                            // Which should not happen as there will be an array if exists prevRecord,even if all deleted, will remain an empty array
                            // But for safety now avoid
                        }
                        else {// Exists entry for that particular category, meaning update spent & comment will do.
                            const updatePartial = await dbPool.query(`UPDATE records SET record_data=JSON_REPLACE(record_data,'$[${categRecordIdx}].spent',${spent},'$[${categRecordIdx}].comment','${comment}') WHERE record_id = '${recordIdStr}' AND username ='${username}'`);
                        }
                        Object.defineProperty(newRecordObject, "date", { value: date, enumerable: true });
                        res.status(200).send(JSON.stringify({ update: true, new: false, added: newRecordObject }));
                    }
                    // try {
                    //     let updatedRecord;
                    //     const categRecordIdx = prevRecord[0].record_data.findIndex(({ category: categ }) => categ === category);
                    //     const prevRecordArr = prevRecord[0].record_data; //the data in database is an array as JSON
                    //     if (categRecordIdx === -1) { updatedRecord = [...prevRecordArr, newRecordObject]; }
                    //     else {
                    //         prevRecordArr[categRecordIdx] = newRecordObject;
                    //         updatedRecord = JSON.parse(JSON.stringify(prevRecordArr)); //create a copy, or toSpliced / with
                    //         // updatedRecord = prevRecordArr.with(categRecordIdx,newRecordObject);
                    //     }
                    //     const updateDB = await dbPool.query(`UPDATE records SET record_data='${JSON.stringify(updatedRecord)}' WHERE record_id = '${recordIdStr}' AND username ='${username}'`);

                    //     Object.defineProperty(newRecordObject, "date", { value: date, enumerable: true });
                    //     res.status(200).send(JSON.stringify({ update: true, new: false, added: newRecordObject }));

                    //     console.log(`--Updated records entry: id=> ${recordIdStr} entry=> ${JSON.stringify(updatedRecord)}`, updateDB);
                    // }
                    catch (error) {
                        console.error(error);
                        throw error;
                    }
                }
                else {
                    try {
                        const createNew = await dbPool.query(`INSERT INTO records VALUES ('${recordIdStr}','${JSON.stringify([newRecordObject])}','${date}','${username}')`);
                        Object.defineProperty(newRecordObject, "date", { value: date, enumerable: true });
                        res.status(201).send(JSON.stringify({ update: false, new: true, added: newRecordObject }));
                        console.log(`--Added new records entry: id=> ${recordIdStr} entry=> ${JSON.stringify(newRecordObject)}`, createNew);
                    }
                    catch (error) {
                        console.error(error);
                        throw error;
                    }
                }
            }
            catch (error) {
                console.error(error);
                throw error;
            }
        }
        else if (!allValid) {
            res.status(400).render('redirect', {
                title: "Could Not Add Spendings",
                message: `Request to add spendings could not be fuifilled due to invalid / tampered request.`,
                redirect: { text: "Back to Home", link: "/" },
                status: { type: "error", code: 400, text: "Bad Request" }
            });
        }
    }
});

router.post('/edit-verify', async function (req, res) {
    if (!req.session.userInfo) {
        res.redirect("/")
    }
    else {
        const allValid = await dateSpentCategCommentValidator(req);
        if (allValid) {
            const exists = await recordExistenceValidator(req);
            if (exists) res.status(200).send(JSON.stringify({ verified: exists }));
            else res.status(404).send(JSON.stringify({ verified: exists }));
        }
        else if (!allValid) {
            res.status(400).render('redirect', {
                title: "Could Not Edit Spendings",
                message: `Request to edit spendings could not be fuifilled due to invalid / tampered request.`,
                redirect: { text: "Back to Home", link: "/" },
                status: { type: "error", code: 400, text: "Bad Request" }
            });
        }
    }
});

router.post('/delete', async function (req, res) {
    if (!req.session.userInfo) {
        res.redirect("/")
    }
    else {
        const username = req.session.userInfo;
        const date = req.body.date;
        const category = req.body.category;
        const allValid = await dateSpentCategCommentValidator(req);
        const exists = await recordExistenceValidator(req);
        if (allValid && exists) {
            try {
                const recordIdStr = `${date}_${username}`;
                const [resultPath] = await dbPool.query(`SELECT JSON_SEARCH(record_data,'one','${category}',NULL,'$[*].category') AS index_path FROM records where record_id = '${recordIdStr}' AND username = '${username}'`);
                const [index] = resultPath[0].index_path.match(/(?<=\$\[)\d(?=\])/);
                const updateDB = await dbPool.query(`UPDATE records SET record_data=JSON_REMOVE(record_data,'$[${index}]') WHERE record_id = '${recordIdStr}' AND username ='${username}'`);
                res.status(200).send(JSON.stringify({ deleted: true }));

                //prev 2 steps code
                // const [[result], field] = await dbPool.query(`SELECT record_data FROM records WHERE JSON_CONTAINS(record_data,'{ "spent": ${spent}, "comment": "${comment}", "category": "${category}"}') AND record_id = '${recordIdStr}' AND username = '${username}'`);
                // const [resultPath] = await dbPool.query(`SELECT JSON_SEARCH(record_data,'one','${category}',NULL,'$[*].category') AS index_path FROM records where record_id = '${recordIdStr}' AND username = '${username}'`);
                // const [index] = resultPath[0].index_path.match(/(?<=\$\[)\d(?=\])/); //why this...seems unnecessary.. i can just filter it using js
                // const updatedRecord = structuredClone(result.record_data); //result - double destructuring
                // updatedRecord.splice(index, 1);
                // const updateDB = await dbPool.query(`UPDATE records SET record_data=JSON_REMOVE(record_data,'$[${index}]') WHERE record_id = '${recordIdStr}' AND username ='${username}'`);
                // const updateDB = await dbPool.query(`UPDATE records SET record_data='${JSON.stringify(updatedRecord)}' WHERE record_id = '${recordIdStr}' AND username ='${username}'`);
            }
            catch (error) {
                console.error(error);
                throw error;
            }
        }
        else if (!allValid || !exists) {
            res.status(404).send(JSON.stringify({ deleted: false }));
            // res.status(400).render('redirect', {
            //     title: "Could Not Delete",
            //     message: `Request to delete spendings could not be fuifilled due to invalid / tampered request.`,
            //     redirect: { text: "Back to Home", link: "/" },
            //     status: { type: "error", code: 400, text: "Bad Request" }
            // });
        }
    }
});
module.exports = router;
