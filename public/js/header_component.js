"use strict";

class ExpendRecHeader extends HTMLElement {
    constructor() {
        super();
        const shadowDOM = this.attachShadow({ mode: 'open' });
        const headTemplate = document.createElement("template");
        headTemplate.innerHTML = `
        <nav class='page-navigator'>
            <h1>Expenditure Recorder</h1>
            <a href="/"><img title="Home" alt="Home" src="/images/icons/home_48.svg"></a>
            <a href="/users"><img title="User Page" alt="User Page" src="/images/icons/user_48.svg"></a>
            <a href="/review"><img title="Review" alt="Review" src="/images/icons/chart_48.svg"></a>
        </nav>
        `;
        const linkElm = document.createElement('link');
        linkElm.setAttribute('rel', 'stylesheet');
        linkElm.setAttribute('href', '/css/header_component_style.css');
        shadowDOM.appendChild(linkElm);
        shadowDOM.appendChild(headTemplate.content.cloneNode(true));
    }

}

customElements.define("expendrec-header", ExpendRecHeader);