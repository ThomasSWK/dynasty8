function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatMoney(n) {
  return Number(n).toLocaleString("fr-FR") + "$";
}
