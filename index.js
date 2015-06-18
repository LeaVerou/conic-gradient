function $$(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
}

$$("#examples article").forEach(function (article, i) {
    var style = article.getAttribute("style");
    article.removeAttribute("style");

    var div = document.createElement("div");
    article.appendChild(div);

    var textarea = document.createElement("textarea");
    textarea.textContent = style;
    (textarea.oninput = function() {
        var fixed = StyleFix.fix(this.value);
        div.setAttribute("style", fixed);
    }).call(textarea);

    new Incrementable(textarea);

    article.appendChild(textarea);
});