const express = require('express');
const router = express.Router();
// const dbConnection = require('./dbConnect');
const dbPool = require('./dbPoolPromise');

(async function () {
    try {
        const conn = await dbPool.getConnection();
        console.log('SQL connected as ID ' + conn.threadId);
    }
    catch (err) {
        console.error('Error connecting: ' + err.stack);
    }
})();

router.get('/standard', async function (req, res) {
    try {
        const [result, field] = await dbPool.query('SELECT category_name FROM category ORDER BY category_id');
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).send({ error });
    }
});

router.get('/custom', async function (req, res) {
    const username = req.session.userInfo;
    try {
        const [result, field] = await dbPool.query(`SELECT category_name FROM category_custom WHERE username='${username}'`);
        res.status(200).send(result);
    }
    catch (error) {
        res.status(400).send({ error });
    }
});

module.exports = router;