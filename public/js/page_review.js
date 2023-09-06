"use strict";
import { getCategories } from "./page_create_categ_options.js";

const reviewForm = document.querySelector("form[name='review_form']");
const reviewFormMonthInput = reviewForm.querySelector("input#month");
const reviewFormCategSelect = reviewForm.querySelector("select#category");



document.addEventListener('DOMContentLoaded', () => {
    getMonth();
    getCategories(reviewFormCategSelect);
});

function getMonth() {
    const today = new Date();
    const isoWithOffset = new Date(Date.now() - (today.getTimezoneOffset() * 60000)).toISOString();
    const todayDateISO = isoWithOffset.match(/\d{4}\-\d{2}(?=\-\d{2}T)/);
    // reviewFormMonthInput.value = todayDateISO;
    reviewFormMonthInput.max = todayDateISO;
    return todayDateISO;
}