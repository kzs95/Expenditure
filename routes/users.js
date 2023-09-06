const express = require('express');
const router = express.Router();
const dbPool = require('./dbPoolPromise');
const bcrypt = require('bcrypt');
const validUsernameRegExp = /^[\w!@#$%&*'\-]{6,16}$/;
const validPasswordRegExp = /^(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%])[a-zA-Z!@#$%\d]{8,12}$/;
const validEmailRegExp = /^.*\@.*\.\w*/;
const validCustomCategNameRegExp = /^[\u0020\w]{1,45}$/;

async function passwordValidator(username, passwordToCheck) {
  const [passwordResult] = await dbPool.query(`SELECT password FROM users WHERE username = '${username}'`);
  const hashedPassword = passwordResult[0].password;
  return await bcrypt.compare(passwordToCheck, hashedPassword);
}

router.get('/', async function (req, res, next) {
  if (!req.session.userInfo) res.redirect("/");
  else {
    try {
      const [result, field] = await dbPool.query(`SELECT * FROM users WHERE username = '${req.session.userInfo}'`);
      if (result.length === 0) {
        console.log("--Logged in. But couldn't find user!");
        res.status(404).render('redirect', {
          title: "Not Found",
          message: `Could not retrieve data of username ${req.session.userInfo}`,
          redirect: { text: "Back to Home", link: "/" },
          status: { type: "error", code: 404, text: "Not Found" }
        });
      }
      else {
        res.status(200).render('users', { username: req.session.userInfo, email: result[0].email, userid: result[0].userid });
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
});

//Just in case stuff. Cause no longer render 'redirect.ejs', just render notification message. In case one reloads that /users/login etc.
router.get('/register', async function (req, res, next) {
  res.redirect('/register');
});

router.get('/login', async function (req, res, next) {
  res.redirect('/login');
});

router.post('/register', async function (req, res, next) {
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const validUsername = username ? validUsernameRegExp.test(username) : false;
  const validPassword = password ? validPasswordRegExp.test(password) : false;
  const allValid = validUsername && validPassword;
  if (allValid) {
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const [resultName, field] = await dbPool.query(`SELECT username FROM users WHERE username = '${username}'`);
      const [resultEmail] = await dbPool.query(`SELECT email FROM users WHERE email = '${email}'`);

      if (resultName.length !== 0 || resultEmail.length !== 0) {
        let type;
        if (resultName.length !== 0 && resultEmail.length !== 0) type = "Username & Email";
        else type = resultName.length !== 0 ? "Username" : "Email";
        res.status(409).render('register', { notification: { title: `${type} Already Exists`, message: `An account with the same ${type} already exists.` } });
      }
      else if (resultName.length === 0 && resultEmail.length === 0) {
        try {
          const addNewUser = await dbPool.query(`INSERT INTO users (username,email,password) VALUE ('${username}','${email}','${hashedPassword}')`);
          console.log(`--Created new User!`, addNewUser);
          res.redirect('/login');
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
      title: "Could Not Create Account",
      message: `Request to create an account could not be fuifilled due to invalid / tampered request.`,
      redirect: { text: "Back to Register", link: "/register" },
      status: { type: "error", code: 400, text: "Bad Request" }
    });
  }
});

router.post('/login', async function (req, res, next) {
  console.log("--Login attempt.", req.body);
  const username = req.body.username;
  const password = req.body.password;
  try {
    const [result, field] = await dbPool.query(`SELECT * FROM users WHERE username='${username}'`);
    if (result.length === 0) {
      console.log("--Login failed. No such user!");
      res.status(404).render('login', { notification: { title: "Username Not Found", message: "Cannot find account with the username." } });
      // res.status(404).render('redirect', {
      //   title: "Username Not Found",
      //   message: "No such username.",
      //   redirect: { text: "Relogin", link: "/login" },
      //   status:{type:"error",code:404,text:"Not Found"}
      // });
    }
    else if (result.length !== 0) {
      const hashedPassword = result[0].password;
      const passwordMatch = await bcrypt.compare(password, hashedPassword);
      if (passwordMatch) {
        console.log("--Login success.");
        req.session.userInfo = username;
        res.redirect("/");
      }
      else {
        console.log("--Login failed. Incorrect password.");
        res.status(200).render('login', { notification: { title: "Incorrect Password", message: "Incorrect password entered." } });
        // res.status(200).render('redirect', {
        //   title: "Wrong Password",
        //   message: "Incorrect password entered.",
        //   redirect: { text: "Relogin", link: "/login" },
        //   status:{type:"success",code:200,text:"OK"}
        // });
      }
    }
  }
  catch (error) {
    console.error(error);
    throw error;
  }
});

router.post('/logout', function (req, res, next) {
  req.session.destroy();
  // res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  res.clearCookie('session_cookie_expenditurerecord');
  res.redirect("/");
});

//In case one reloads that success delete page.
router.get('/delete', async function (req, res, next) {
  if (!req.session.userInfo) res.redirect("/");
  else res.status(200).render('delete_account');
});

router.post('/delete', async function (req, res, next) {
  let allDeleted = false;
  const username = req.session.userInfo;
  try {
    const [backupTable_users] = await dbPool.query(`SELECT * FROM users WHERE username='${username}'`);
    const [backupTable_records] = await dbPool.query(` SELECT *,CAST(record_data AS CHAR) AS record_data ,CAST(record_date AS CHAR(10)) AS record_date FROM records WHERE username='${username}'`);
    // const [backupTable_categ] = await dbPool.query(`SELECT * FROM category_custom WHERE username='${username}'`);//change

    function restoreUsers() {
      if (backupTable_users.length !== 0) {
        backupTable_users.forEach(async (rowEntry) => {
          const valueText = Object.values(rowEntry).map((value) => `'${value}'`).join(",");
          console.log("--Restoring User");
          await dbPool.query(`INSERT IGNORE INTO users VALUES (${valueText})`);
        });
      }
    }
    function restoreRecords() {
      if (backupTable_records.length !== 0) {
        backupTable_records.forEach(async (rowEntry) => {
          const valueText = Object.values(rowEntry).map((value) => `'${value}'`).join(",");
          console.log("--Restoring Records");
          await dbPool.query(`INSERT IGNORE INTO records VALUES (${valueText})`);
        });
      }
    }
    // function restoreCateg() {
    //   if (backupTable_categ.length !== 0) {
    //     backupTable_categ.forEach(async (rowEntry) => {
    //       const valueText = Object.values(rowEntry).map((value) => `'${value}'`).join(",");
    //       console.log("--Restoring Custom Categories");
    //       await dbPool.query(`INSERT IGNORE INTO category_custom VALUES (${valueText})`);
    //     });
    //   }
    // }

    dbPool.query(`DELETE FROM users WHERE username='${username}'`) //pt
      .then(
        (result) => {
          console.log("--Deleted from TABLE users!"); //Delete users success, Delete records next.
          return dbPool.query(`DELETE FROM records WHERE username='${username}'`); //pt
        },
        (error) => { //First op. fail.
          console.log("--Failed to delete from TABLE users!");
          throw new Error("Failed to delete from TABLE users!", { cause: "users" });
        }
      )
      .then(
        (result) => {
          console.log("--Deleted from TABLE records!"); //Delete records success, Delete category_custom next.
          return dbPool.query(`DELETE FROM category_custom WHERE username='${username}'`);//pt
        },
        (error) => {
          if (error.cause === 'users') throw error; //First op. fail, rethrow.
          else {
            console.log("--Failed to delete from TABLE users!"); //Second fail, restore first (users)!
            throw new Error("Failed to delete from TABLE users!", { cause: "records" });
          }
        }
      )
      .then(
        (result) => {
          allDeleted = true;
          console.log("--Deleted from CATEGORY records! All done."); //Delete category success, Everything deleted.
        },
        (error) => {
          if (error.cause === 'users' || error.cause === 'records') throw error; //First or 2nd fail, rethrow error & do nothing.
          else {
            console.log("--Failed to delete from CATEGORY users!");//Third fail, restore first and second (users & records)!
            throw new Error("Failed to delete from CATEGORY users!", { cause: "category" });
          }
        }
      )
      .catch((error) => {
        console.log(error);
        if (error.cause === 'records') {
          restoreUsers();
        }
        else if (error.cause === 'category') {
          restoreUsers();
          restoreRecords();
        }
      })
      .finally(() => {
        if (allDeleted) {
          req.session.destroy();
          res.clearCookie('session_cookie_expenditurerecord');
          // res.redirect('/');
          res.status(200).render('redirect', {
            title: "Account Deleted",
            message: "Your account was successfully deleted",
            redirect: { text: "Home", link: "/" },
            status: { type: "success", code: 200, text: "OK" }
          });
        }
        else if (!allDeleted) {
          res.status(500).render('redirect', {
            title: "Unable to Delete",
            message: "Encountered and error when deleting the account",
            redirect: { text: "Userpage", link: "/users" },
            status: { type: "error", code: 500, text: "Internal Server Error" }
          });
        }
      });

    //Before those restore stuff version
    // const deleteTable_users = await dbPool.query(`DELETE FROM users WHERE username='${username}'`);
    // const deleteTable_records = await dbPool.query(`DELETE FROM records WHERE username='${username}'`);
    // const deleteTable_categ = await dbPool.query(`DELETE FROM category_custom WHERE username='${username}'`);//change
    // req.session.destroy();
    // res.clearCookie('session_cookie_expenditurerecord');
    // res.redirect('/');
  }
  catch (error) {
    console.error("--Problem Deleting Account!", error);
    throw error;
  }
});

router.get('/add-category', function (req, res, next) {
  if (!req.session.userInfo) res.redirect("/");
  else res.status(200).render('category_manage', { role: "Add", status: null, notification: null });
});

router.post('/add-category', async function (req, res, next) {
  const new_category_name = req.body.category_name;
  const validCategName = new_category_name ? validCustomCategNameRegExp.test(new_category_name) : false;
  let largestIdCount = 0;
  let isStandard = false, isCustom = false;
  //First check if exists as standard
  if (validCategName) {
    try {
      const [result, field] = await dbPool.query(`SELECT category_name FROM category`);
      if (result.length !== 0) {
        const standardCategArr = result.map((entry) => entry.category_name.toLowerCase());
        if (standardCategArr.includes(new_category_name.toLowerCase())) isStandard = true;
      }
    }
    catch (error) {
      console.error(error);
      throw error;
    }
    if (!isStandard) { //If not standard, proceed to check if exists as custom
      try {
        const [result, field] = await dbPool.query(`SELECT * FROM category_custom WHERE username='${req.session.userInfo}'`);
        if (result.length !== 0) {
          const customCategInfo = result.reduce((recorder, entry) => {
            const categIdNoPart = entry.category_id.match(/(?<=\_CC\_)\d+$/);
            if (Number.parseInt(categIdNoPart) > recorder.largestId) recorder.largestId = Number.parseInt(categIdNoPart);
            recorder.lowercaseName.push(entry.category_name.toLowerCase());
            return { ...recorder };
          }, { largestId: 0, lowercaseName: [], __proto__: null });
          largestIdCount = customCategInfo.largestId;
          if (customCategInfo.lowercaseName.includes(new_category_name.toLowerCase())) isCustom = true;
        }
      }
      catch (error) {
        console.error(error);
        throw error;
      }
    }
    //If discovered is standard or is custom, notify user and ask to reenter,else add to database then return to userpage
    if (isCustom || isStandard) {
      res.status(409).render('category_manage', {
        role: "Add", status: "Fail", notification:
          { title: "Duplicate", message: `The category you just entered, ${new_category_name}, already exists as a ${isCustom ? "custom" : "standard"} category. Why not use that instead?` }
      });
    }
    else if (!isCustom && !isStandard) {
      try {
        const generateId = `${req.session.userInfo}_CC_${++largestIdCount}`
        const newCategEntry = await dbPool.query(`INSERT INTO category_custom (category_id,category_name,username) VALUE('${generateId}','${new_category_name}','${req.session.userInfo}')`);
        console.log(newCategEntry);
        res.status(200).render('category_manage', {
          role: "Add", status: "Success", notification:
            { title: "Success", message: `New custom category ${new_category_name} successfully added!` }
        });
      }
      catch (error) {
        console.error("--Problem adding category!", error);
        throw error;
      }
    }
  }
  else if (!validCategName) {
    res.status(400).render('category_manage', {
      role: "Add", status: "Fail", notification:
        { title: "Invalid Format", message: `Please enter a category name with valid format.` }
    });
  }
});

router.get('/edit-category', function (req, res, next) {
  if (!req.session.userInfo) res.redirect("/");
  else res.status(200).render('category_manage', { role: 'Edit', status: null, notification: null });
});

router.post('/edit-category', async function (req, res, next) {
  const username = req.session.userInfo;
  const new_name = req.body.category_name_new;
  const prev_name = req.body.category_name_prev;

  const [allCateg] = await dbPool.query(`SELECT category_name FROM category UNION SELECT category_name FROM category_custom WHERE username='${username}'`);
  const validCateg = prev_name ? allCateg.map((entry) => entry.category_name).includes(prev_name) : false;
  const validCategNewName = new_name ? validCustomCategNameRegExp.test(new_name) : false; //If the user submit by tampering the form's pattern attribute

  if (validCateg && validCategNewName) {
    try {
      const customCategArr = allCateg.map((entry) => entry.category_name.toLowerCase());
      const existed = customCategArr.includes(new_name.toLowerCase());
      if (existed) {
        res.status(409).render('category_manage', {
          role: 'Edit', status: "Fail", notification:
            { title: "Duplicate", message: `The category name, ${new_name}, already existed!` }
        });
      }
      else {
        const updateCategName = await dbPool.query(`UPDATE category_custom SET category_name=REPLACE(category_name,'${prev_name}','${new_name}') WHERE username='${username}'`);
        const [categRecordIndexes] = await dbPool.query(`SELECT record_id,JSON_SEARCH(record_data,'one','${prev_name}',NULL,'$[*].category') AS path FROM records WHERE username='${username}' AND JSON_SEARCH(record_data,'one','${prev_name}',NULL,'$[*].category')`);
        for (const { record_id, path } of categRecordIndexes) {
          const [indexInEntryArray] = path.match(/(?<=\$\[)\d(?=\])/);
          const updateEntries = await dbPool.query(`UPDATE records SET record_data=JSON_REPLACE(record_data,'$[${Number.parseInt(indexInEntryArray)}].category','${new_name}') WHERE record_id='${record_id}' AND username='${username}'`);
        }
        res.status(200).render('category_manage', {
          role: 'Edit', status: "Success", notification:
            { title: "Changed", message: `Successfully changed ${prev_name} to ${new_name}. Updated ${categRecordIndexes.length} entry(s).` }
        });
      }
    }
    catch (error) {
      console.error(error);
      throw error;
    }
  }
  else if (!validCateg) {
    res.status(404).render('redirect', {
      title: "Could Not Find Such Category",
      message: `Request to rename category could not be fuifilled due to invalid / tampered request.`,
      redirect: { text: "Back to Category Edit", link: "/users/edit-category" },
      status: { type: "error", code: 404, text: "Not Found" }
    });
  }
  else if (!validCategNewName) {
    res.status(400).render('category_manage', {
      role: "Edit", status: "Fail", notification:
        { title: "Invalid Format", message: `Please enter a category name with valid format.` }
    });
  }
});

router.get('/delete-category', function (req, res, next) {
  if (!req.session.userInfo) res.redirect("/");
  else res.render('category_manage', { role: 'Delete', status: null, notification: null });
});

router.post('/delete-category', async function (req, res, next) {
  const username = req.session.userInfo;
  const categ_to_delete = req.body.category_name_delete;
  const [allCateg] = await dbPool.query(`SELECT category_name FROM category UNION SELECT category_name FROM category_custom WHERE username='${username}'`);
  const validCateg = categ_to_delete ? allCateg.map((entry) => entry.category_name).includes(categ_to_delete) : false;
  if (validCateg) {
    try {
      const deleteCateg = await dbPool.query(`DELETE FROM category_custom WHERE category_name='${categ_to_delete}' AND username='${username}'`);
      const [categRecordIndexes] = await dbPool.query(`SELECT record_id,JSON_SEARCH(record_data,'one','${categ_to_delete}',NULL,'$[*].category') AS path FROM records WHERE username='${username}' AND JSON_SEARCH(record_data,'one','${categ_to_delete}',NULL,'$[*].category')`);
      for (const { record_id, path } of categRecordIndexes) {
        const [indexInEntryArray] = path.match(/(?<=\$\[)\d(?=\])/);
        const updateEntries = await dbPool.query(`UPDATE records SET record_data=JSON_REMOVE(record_data,'$[${Number.parseInt(indexInEntryArray)}]') WHERE record_id='${record_id}' AND username='${username}'`);
      }
      res.status(200).render('category_manage', {
        role: 'Delete', status: "Success", notification:
          { title: "Deleted", message: `Successfully deleted ${categ_to_delete} and ${categRecordIndexes.length} entry(s).` }
      });
    }
    catch (error) {
      console.error(error);
      throw error;
    }
  }
  else if (!validCateg) {
    res.status(404).render('redirect', {
      title: "Could Not Find Such Category",
      message: `Request to delete category could not be fuifilled due to invalid / tampered request.`,
      redirect: { text: "Back to Category Delete", link: "/users/delete-category" },
      status: { type: "error", code: 404, text: "Not Found" }
    });
  }
});
router.get('/edit-details', function (req, res, next) {
  if (!req.session.userInfo) res.redirect("/");
  else res.status(200).render('users_info_edit', { status: null, notification: null });
});

router.get('/edit-details/change-username', function (req, res, next) {
  res.redirect("/users/edit-details");
});

router.post('/edit-details/change-username', async function (req, res, next) {
  const password = req.body.password;
  const username_new = req.body.username_new;
  const username_prev = req.session.userInfo;
  const validUsername = username_new ? validUsernameRegExp.test(username_new) : false;
  const validPassword = password ? await passwordValidator(req.session.userInfo, password) : false;

  if (validPassword && validUsername) {
    if (username_new === username_prev) {
      res.status(409).render('users_info_edit', {
        status: "Fail", notification:
          { title: "Same Username", message: `Same username submitted. No changes will be performed.` }
      });
    }
    else {
      try {
        const [existingNames] = await dbPool.query(`SELECT username FROM users WHERE username = '${username_new}'`);
        if (existingNames.length !== 0) {
          res.status(409).render('users_info_edit', {
            status: "Fail", notification:
              { title: "Duplicate", message: `An account with the same username already exists.` }
          });
        }
        else if (existingNames.length === 0) {
          const [allRecord] = await dbPool.query(`SELECT record_id,username FROM records WHERE username='${username_prev}'`);
          const [allCateg] = await dbPool.query(`SELECT category_id,username FROM category_custom WHERE username='${username_prev}'`);

          for (const { record_id, username } of allRecord) {//records 2 columns changes
            const newRecordId = record_id.replace(username, username_new);
            const updateRecord = await dbPool.query(`UPDATE records SET record_id='${newRecordId}',username='${username_new}' WHERE record_id='${record_id}'`);
          }

          for (const { category_id, username } of allCateg) { //category_custom 2 columns changes
            const newCategoryId = category_id.replace(username, username_new);
            const updateCateg = await dbPool.query(`UPDATE category_custom SET category_id='${newCategoryId}',username='${username_new}' WHERE category_id='${category_id}'`);
          }

          const updateName = await dbPool.query(`UPDATE users SET username='${username_new}' WHERE username='${username_prev}'`);
          req.session.userInfo = username_new; //change session info

          res.status(200).render('users_info_edit', {
            status: "Success", notification:
              { title: "Changed", message: `Successfully changed username to ${username_new}.` }
          });
        }
      }
      catch (error) {
        console.error(error);
        throw error;
      }
    }
  }
  else if (!validPassword) {
    res.status(400).render('users_info_edit', {
      status: "Fail", notification:
        { title: "Incorrect Password", message: `Not allowed to change username due to incorrect password!` }
    });
  }
  else if (!validUsername) {
    res.status(400).render('users_info_edit', {
      status: "Fail", notification:
        { title: "Invalid", message: `Invalid username submitted!` }
    });
  }
});

router.get('/edit-details/change-email', function (req, res, next) {
  res.redirect("/users/edit-details");
});

router.post('/edit-details/change-email', async function (req, res, next) {
  const username = req.session.userInfo;
  const email_new = req.body.email_new;
  const password = req.body.password;
  const validEmail = email_new ? validEmailRegExp.test(email_new) : false;
  const validPassword = password ? await passwordValidator(username, password) : false;

  if (validPassword && validEmail) {
    const [existingEmail] = await dbPool.query(`SELECT email FROM users WHERE email='${email_new}'`);
    if (existingEmail.length !== 0) {
      res.status(409).render('users_info_edit', {
        status: "Fail", notification:
          { title: "Duplicate", message: `An account with the same email address already exists.` }
      });
    }
    else if (existingEmail.length === 0) {
      const updateEmail = await dbPool.query(`UPDATE users SET email='${email_new}' WHERE username='${username}'`);
      res.status(200).render('users_info_edit', {
        status: "Success", notification:
          { title: "Changed", message: `Successfully changed email to ${email_new}.` }
      });
    }
  }
  else if (!validPassword) {
    res.status(400).render('users_info_edit', {
      status: "Fail", notification:
        { title: "Incorrect Password", message: `Not allowed to change email due to incorrect password!` }
    });
  }
  else if (!validEmail) {
    res.status(400).render('users_info_edit', {
      status: "Fail", notification:
        { title: "Invalid Email", message: `Please enter an email address with valid format.` }
    });
  }
});

router.get('/edit-details/change-password', function (req, res, next) {
  res.redirect("/users/edit-details");
});

router.post('/edit-details/change-password', async function (req, res, next) {
  const username = req.session.userInfo;
  const password = req.body.password;
  const password_new = req.body.password_new;
  const validPassword = password ? await passwordValidator(username, password) : false;
  const validNewPassword = password_new ? validPasswordRegExp.test(password_new) : false;

  if (validPassword && validNewPassword) {
    if (password_new === password) {
      res.status(400).render('users_info_edit', {
        status: "Fail", notification:
          { title: "Same Password", message: `New password cannot be the same as previous password!` }
      });
    }
    else {
      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(password_new, saltRounds);
      const updatePassword = await dbPool.query(`UPDATE users SET password='${hashedNewPassword}' WHERE username='${username}'`);
      res.status(200).render('users_info_edit', {
        status: "Success", notification:
          { title: "Changed", message: `Successfully changed password.` }
      });
    }
  }
  else if (!validPassword) {
    res.status(400).render('users_info_edit', {
      status: "Fail", notification:
        { title: "Incorrect Password", message: `Not allowed to change email due to incorrect password!` }
    });
  }
  else if (!validNewPassword) {
    res.status(400).render('users_info_edit', {
      status: "Fail", notification:
        { title: "Invalid Password Format", message: `Please enter a new password with valid format.` }
    });
  }
});

module.exports = router;