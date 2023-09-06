"use strict";
export async function getCategories(selectElm) {
    try {
        const getCateg = await fetch('/category/custom');
        if (getCateg.status === 200) {
            const categ = await getCateg.json();
            if (categ.length !== 0) {
                const optgroupCust = document.createElement("optgroup");
                optgroupCust.setAttribute("label", "Custom");
                for (const { category_name: categName } of categ) {
                    const option = document.createElement("option");
                    option.setAttribute("value", categName);
                    option.textContent = categName;
                    optgroupCust.appendChild(option);
                }
                selectElm.appendChild(optgroupCust);
            }
        }
        else if (getCateg.status !== 200) {
            throw new Error(`Fail to fetch custom categories!`);
        }
    }
    catch (err) {
        console.warn(err)
    }
    try {
        const getCateg = await fetch('/category/standard');
        if (getCateg.status === 200) {
            const categ = await getCateg.json();
            const optgroupStd = document.createElement("optgroup");
            optgroupStd.setAttribute("label", "Standard");
            for (const { category_name: categName } of categ) {
                const option = document.createElement("option");
                option.setAttribute("value", categName);
                option.textContent = categName;
                optgroupStd.appendChild(option);
            }
            selectElm.appendChild(optgroupStd);
        }
        else if (getCateg.status !== 200) {
            console.log(await getCateg.json())
            throw new Error(`Fail to fetch categories!`);
        }
    }
    catch (err) {
        console.warn(err.message)
    }
}