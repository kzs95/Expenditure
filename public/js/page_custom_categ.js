const categChangeForm = document.querySelector("form[name='custom_category_change']");
const customCategSelect = document.querySelector("select#custom_category_list");

document.addEventListener("DOMContentLoaded", () => {
    getCustomCategories();
});

async function getCustomCategories() {
    try {
        const getCateg = await fetch('/category/custom');
        if (getCateg.status === 200) {
            const categ = await getCateg.json();
            if (categ.length !== 0) {
                for (const { category_name: categName } of categ) {
                    const option = document.createElement("option");
                    option.setAttribute("value", categName);
                    option.textContent = categName;
                    customCategSelect.appendChild(option);
                }
            }
            else{
                const noCategMsg = document.createElement("p");
                noCategMsg.innerHTML = "No custom element added yet. You may add them <a class='userpage-link-button' href='/users/add-category'>here</a>."
                categChangeForm.replaceWith(noCategMsg)
            }
        }
        else if (getCateg.status !== 200) {
            throw new Error(`Fail to fetch custom categories!`);
        }
    }
    catch (err) {
        console.warn(err)
    }
}