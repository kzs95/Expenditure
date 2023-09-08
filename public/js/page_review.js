"use strict";
import { getCategories } from "./page_create_categ_options.js";

const monthReviewForm = document.querySelector("form[name='review_form_month']");
const monthReviewMonthInput = monthReviewForm?.querySelector("input#month");
const monthReviewCategSelect = monthReviewForm?.querySelector("select#category");

const yearReviewForm = document.querySelector("form[name='review_form_year']");
const yearReviewCategSelect = yearReviewForm?.querySelector("select#category");
const yearReviewYearFrom = yearReviewForm?.querySelector("select#yearFrom");
const yearReviewYearTo = yearReviewForm?.querySelector("select#yearTo");
const singleYearReviewChk = yearReviewForm?.querySelector("input#single-year");

document.addEventListener('DOMContentLoaded', () => {
    if (monthReviewForm) {
        getMonth();
        getCategories(monthReviewCategSelect);
    }
    else if (yearReviewForm) {
        getYearWithRecords();
        getCategories(yearReviewCategSelect);
    }
});
if (yearReviewForm) {
    yearReviewYearFrom.addEventListener('input', (event) => {
        const from = Number.parseInt(yearReviewYearFrom.value);
        yearReviewYearTo.value = "";
        Array.from(yearReviewYearTo.querySelectorAll("option")).forEach((optionElm) => {
            const value = optionElm.value;
            if (value < from) optionElm.toggleAttribute('disabled', true);
            else optionElm.toggleAttribute('disabled', false);
        })
    });

    yearReviewYearTo.addEventListener('input', (event) => {
        const from = Number.parseInt(yearReviewYearFrom.value);
        const to = Number.parseInt(yearReviewYearTo.value);
        if (to < from) {
            yearReviewYearTo.setCustomValidity("This must be larger than starting year!");
            event.preventDefault();
        }
        else {
            yearReviewYearTo.setCustomValidity("");
        }
        yearReviewYearTo.reportValidity();
    });

    singleYearReviewChk.addEventListener("change", (event) => {
        if (event.target.checked) {
            yearReviewYearTo.toggleAttribute('disabled', true);
            yearReviewYearTo.toggleAttribute('required', false);
        }
        else if (!event.target.checked) {
            yearReviewYearTo.toggleAttribute('disabled', false);
            yearReviewYearTo.toggleAttribute('required', true);
        }
    });
}

function getMonth() {
    const today = new Date();
    const isoWithOffset = new Date(Date.now() - (today.getTimezoneOffset() * 60000)).toISOString();
    const todayDateISO = isoWithOffset.match(/\d{4}\-\d{2}(?=\-\d{2}T)/);
    // monthReviewMonthInput.value = todayDateISO;
    monthReviewMonthInput.max = todayDateISO;
    return todayDateISO;
}

async function getYearWithRecords() {
    try {
        const getYearData = await fetch(`/review/recorded-years`);
        if (getYearData.status === 200) {
            const yearData = await getYearData.json();
            if (yearData.length !== 0) {
                yearData.forEach(({ years }) => {
                    const yearOption = document.createElement('option');
                    yearOption.setAttribute("value", years);
                    yearOption.textContent = years;
                    yearReviewYearFrom.append(yearOption);
                    yearReviewYearTo.append(yearOption.cloneNode(true));
                });
            }
            else {
                const noRecordText = document.createElement("p");
                noRecordText.textContent = 'No records to be reviewed yet!'
                yearReviewYearFrom.replaceWith(noRecordText);
            }
        }
        else if (getYearData.status !== 200) {
            throw new Error(`Fail to fetch year data!`);
        }
    }
    catch (err) {
        console.warn(err);
    }
}