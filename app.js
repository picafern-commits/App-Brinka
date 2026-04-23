const values=[50,20,10,5,2,1,0.5,0.2];
const money=document.getElementById('money');

values.forEach(v=>{
let div=document.createElement('div');
div.className='row';
div.innerHTML=`
<span>${v}€</span>
<input type="number" value="0" onchange="calc()">
<span class="sub">0€</span>`;
money.appendChild(div);
});

function calc(){
let total=0;
document.querySelectorAll('.row').forEach((r,i)=>{
let q=r.querySelector('input').value;
let sub=q*values[i];
r.querySelector('.sub').innerText=sub+'€';
total+=sub;
});
document.getElementById('total').innerText=total+'€';
}

function save(){
let total=document.getElementById('total').innerText;
let list=JSON.parse(localStorage.getItem('b'))||[];
list.push({t:total,d:new Date().toLocaleString()});
localStorage.setItem('b',JSON.stringify(list));
load();
}

function load(){
let list=JSON.parse(localStorage.getItem('b'))||[];
let el=document.getElementById('list');
el.innerHTML=list.map(i=>`<div class='card'>${i.t} - ${i.d}</div>`).join('');
let sum=0;
list.forEach(i=>sum+=parseFloat(i.t));
document.getElementById('today').innerText=sum+'€';
}

function nav(p){
document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));
document.getElementById(p).classList.add('active');
}

load();
