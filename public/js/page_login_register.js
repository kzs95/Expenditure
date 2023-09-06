const passwordShow = document.querySelector("input.show-password");
const passwordInput = document.querySelector("input[id$='-password']");

passwordShow.addEventListener("change", (event) => {
    if (event.target.checked) passwordInput.type = 'text';
    else if (!event.target.checked) passwordInput.type = 'password';
})
