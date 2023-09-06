const passwordShow = document.querySelector("input.show-password");
const passwordInputs = document.querySelectorAll("input[type='password']");

passwordShow.addEventListener("change", (event) => {
    if (event.target.checked){
        passwordInputs.forEach((passInput)=>passInput.type = 'text')
    }
    else if (!event.target.checked){
        passwordInputs.forEach((passInput)=>passInput.type = 'password')
    }
})
