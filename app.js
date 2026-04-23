const notas = [500,200,100,50,20,10,5,2,1,0.5,0.2,0.1,0.05,0.02,0.01];
const container = document.getElementById("container");

notas.forEach(valor => {
  const row = document.createElement("div");
  row.className = "row";

  row.innerHTML = `
    <span>${valor}€</span>
    <input type="number" min="0" value="0" onchange="calcular()">
    <span class="subtotal">0€</span>
  `;

  container.appendChild(row);
});

function calcular() {
  let total = 0;
  const rows = document.querySelectorAll(".row");

  rows.forEach((row, index) => {
    const input = row.querySelector("input");
    const subtotalEl = row.querySelector(".subtotal");

    const qtd = parseFloat(input.value) || 0;
    const valor = notas[index];
    const subtotal = qtd * valor;

    subtotalEl.innerText = subtotal.toFixed(2) + "€";
    total += subtotal;
  });

  document.getElementById("total").innerText = total.toFixed(2) + "€";
}

function guardar() {
  const total = document.getElementById("total").innerText;
  const data = new Date().toLocaleString();

  let historico = JSON.parse(localStorage.getItem("brinka")) || [];

  historico.push({
    total,
    data
  });

  localStorage.setItem("brinka", JSON.stringify(historico));

  alert("Fecho guardado!");
}
