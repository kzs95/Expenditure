"use strict";
const spendingEntryForm = document.querySelector("form[name='spending-entry']");
const spendingEntryFormDayInput = spendingEntryForm .querySelector("input#day");
const spendingEntryFormCategSelect = spendingEntryForm.querySelector("select#category");
const spendingEntryFormSpent = spendingEntryForm.querySelector("input#spent");
const spendingEntryFormComment = spendingEntryForm.querySelector("textarea#comment");


export { getDayRecord };
import { getCategories } from "./page_create_categ_options.js";

document.addEventListener("DOMContentLoaded", () => {
    getTodayDateISO();
    getCategories(spendingEntryFormCategSelect);
    getDayRecord();
});

spendingEntryForm.addEventListener("submit", addSpendingEntry)
spendingEntryFormDayInput.addEventListener("change", getDayRecord);
spendingEntryFormCategSelect.addEventListener("change",resetSpentComment)

function resetSpentComment(){
    spendingEntryFormSpent.value="";
    spendingEntryFormComment.value="";
}

function getTodayDateISO() {
    const today = new Date();
    const isoWithOffset = new Date(Date.now() - (today.getTimezoneOffset() * 60000)).toISOString();
    const todayDateISO = isoWithOffset.match(/\d{4}\-\d{2}\-\d{2}(?=T)/);
    spendingEntryFormDayInput.value = todayDateISO;
    spendingEntryFormDayInput.max = todayDateISO;
    return todayDateISO;
}

async function getDayRecord() {
    const dateInput = document.querySelector("input#day");
    const displayArea = document.querySelector("div#record-item-area");
    const dateInputVal = dateInput.value;
    dateInput.form.reset();
    dateInput.value = dateInputVal;
    if (dateInputVal) {
        try {
            const getRecordData = await fetch(`/spending?date=${dateInputVal}`);
            if (getRecordData.status === 200) {
                const recordData = await getRecordData.json();
                const records = recordData.record_data;
                if (records.length === 0) displayArea.textContent = "No expenditure record yet!";
                else {
                    const recordTable = document.createElement("record-table");
                    records.forEach((record) => recordTable.addEntry(record));
                    displayArea.replaceChildren(recordTable);
                }
            }
        }
        catch (err) {
            console.warn(err);
        }
    }
}

async function addSpendingEntry(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const sendData = [...formData.entries()].reduce((obj, [name, value]) => {
        obj[name] = value;
        return { ...obj };
    }, {});
    try {
        const addEntry = await fetch('/spending/add', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(sendData)
        });
        if (addEntry.status === 200 || addEntry.status === 201) {
            const addedEntry = await addEntry.json();
            const displayArea = document.querySelector("div#record-item-area");
            const existingTable = displayArea.querySelector("record-table");
            if (existingTable) existingTable.addEntry(addedEntry.added);
            else {
                const recordTable = document.createElement("record-table");
                recordTable.addEntry(addedEntry.added);
                displayArea.replaceChildren(recordTable);
            }
        }
    }
    catch (err) {
        console.warn(err);
    }
}