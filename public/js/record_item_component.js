"use strict";
import { getDayRecord } from "./page_index.js";

function validateRecord(record) {
    const validKeys = ['category', 'spent', 'comment', 'date'];
    const recordValidity = validKeys.reduce((state, key) => {
        const contains = Object.keys(record).includes(key);
        return contains && state;
    }, true);
    return recordValidity;
}

class RecordTable extends HTMLElement {
    #stored_record;
    constructor() {
        super();
        this.#stored_record = [];
        const shadowDOM = this.attachShadow({ mode: 'open' });
        const containerTemplate = document.createElement("template");
        containerTemplate.innerHTML = `
        <div class="container-legend">
            <div class="col-category">Category</div>
            <div class="col-spent">Spent</div>
            <div class="col-comment">Add. Details</div>
            <div class="col-action">Action</div>
        </div>
        <div class="container-items">
        </div>
        `;
        const linkElm = document.createElement('link');
        linkElm.setAttribute('rel', 'stylesheet');
        linkElm.setAttribute('href', '/css/record_item_component_style.css');
        shadowDOM.appendChild(linkElm);
        shadowDOM.appendChild(containerTemplate.content.cloneNode(true));
    }

    #checkCategExistence(record) {
        const recordCateg = record.category;
        const indexInArray = this.#stored_record.findIndex(({ category }) => category === recordCateg);
        return indexInArray;
    }

    addEntry(record) {
        const validRecord = validateRecord(record);
        if (!validRecord) throw new Error("Invalid data passed!");
        else {
            const indexInStoredRecord = this.#checkCategExistence(record);
            if (indexInStoredRecord === -1) {
                const recordDeepCopy = structuredClone(record);
                const recordItem = document.createElement("record-item");
                recordItem.insertData(record);
                this.shadowRoot.querySelector(".container-items").append(recordItem);
                Object.defineProperty(recordDeepCopy, "element", { value: recordItem });
                this.#stored_record.push(recordDeepCopy);
            }
            else {
                const storedRecord = this.#stored_record[indexInStoredRecord];
                storedRecord.element.insertData(record);
                Object.assign(storedRecord, record);
            }
        }
    }

    deleteEntry(record) {
        const validRecord = validateRecord(record);
        if (!validRecord) throw new Error("Invalid data passed!");
        else {
            const indexInStoredRecord = this.#checkCategExistence(record);
            if (indexInStoredRecord === -1) throw new Error("Nothing to delete! Data is tampered!");
            else {
                const [deletedRecord] = this.#stored_record.splice(indexInStoredRecord, 1);
                deletedRecord.element.remove();
                getDayRecord(); // old: if (this.#stored_record.length === 0) this.remove();
            }
        }
    }
}
class RecordItem extends HTMLElement {
    #record_data;
    constructor() {
        super();
        this.#record_data = null;
        const shadowDOM = this.attachShadow({ mode: 'open' });
        const recordTemplate = document.createElement("template");
        recordTemplate.innerHTML = `
        <div class="item-wrapper">
            <div class="col-category" id="category"></div>
            <div class="col-spent" id="spent"></div>
            <div class="col-comment" id="comment"></div>
            <div class="col-action" id="action-button">
                <button id="item-edit">Edit</button>
                <button id="item-delete">Delete</button>
            </div>
        </div>
        `;
        const linkElm = document.createElement('link');
        linkElm.setAttribute('rel', 'stylesheet');
        linkElm.setAttribute('href', '/css/record_item_component_style.css');
        shadowDOM.appendChild(linkElm);
        shadowDOM.appendChild(recordTemplate.content.cloneNode(true));
    }

    insertData(record) {
        const shadowRoot = this.shadowRoot;
        const validRecord = validateRecord(record);
        if (!validRecord) throw new Error("Invalid data passed!");
        else {
            this.#record_data = record;
            shadowRoot.querySelector("#category").textContent = record.category;
            shadowRoot.querySelector("#spent").textContent = record.spent;
            shadowRoot.querySelector("#comment").textContent = record.comment;
        }
    }

    connectedCallback() {
        const thisElm = this;
        const shadowRoot = this.shadowRoot;
        const btnEdit = shadowRoot.querySelector("#item-edit");
        const btnDelete = shadowRoot.querySelector("#item-delete");
        //Test static method /provate method to store function add event lister see if duplicate

        btnEdit.addEventListener("click", copyToForm);
        btnDelete.addEventListener("click", deleteSpending);

        async function copyToForm() {
            const record = thisElm.#record_data;
            try {
                const checkExist = await fetch('/spending/edit-verify', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(record)
                });
                if (checkExist.status === 200) {
                    const response = await checkExist.json();
                    if (response.verified) {
                        const form = document.querySelector("form[name='spending-entry']");
                        form.querySelector("#day").value = record.date;
                        form.querySelector("#category").value = record.category;
                        form.querySelector("#spent").value = record.spent;
                        form.querySelector("#comment").value = record.comment;
                    };
                }
                else throw new Error("Not Found in Database!")
            }
            catch (err) {
                console.warn(err);
            }
        }

        async function deleteSpending(event) {
            const record = thisElm.#record_data;
            try {
                const checkExist = await fetch('/spending/delete', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(record)
                });
                if (checkExist.status === 200) {
                    const response = await checkExist.json();
                    if (response.deleted) {
                        const recordTable = event.target.closest("record-table");
                        recordTable.deleteEntry(record);
                    };
                }
                else throw new Error("Not Found in Database!")
            }
            catch (err) {
                console.warn(err);
            }
        }
    }
}

customElements.define("record-table", RecordTable);
customElements.define("record-item", RecordItem);