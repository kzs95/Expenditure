const customCategInsert = document.querySelector("#replace-custom-category");

document.addEventListener("DOMContentLoaded", async (event) => {
    try {
        const getCateg = await fetch('/category/custom');
        if (getCateg.status === 200) {
            const categ = await getCateg.json();
            if (categ.length === 0) {
                customCategInsert.textContent = 'No custom categories added!';
            }
            else if (categ.length !== 0) {
                //categ = [{category_name: 'Video Games'}]
                const list = document.createElement("ul");
                categ.forEach(({ category_name }) => {
                    const listItem = document.createElement("li");
                    listItem.textContent = category_name;
                    list.append(listItem)

                });
                customCategInsert.appendChild(list);
            }
        }
        else if (getCateg.status !== 200) {
            throw new Error(`Fail to fetch custom categories!`);
        }
    }
    catch (error) {
        customCategInsert.textContent = error.toString();
        customCategInsert.style.color = "red";
        console.warn(error)
    }
});