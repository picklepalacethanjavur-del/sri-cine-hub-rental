const assert = require("assert");
const fs = require("fs");

const consoleHtml = fs.readFileSync("console.html", "utf8");
const landingHtml = fs.readFileSync("src-studio.html", "utf8");

assert(consoleHtml.includes('addEventListener("pointerdown",e=>{MODAL_BACKDROP_DOWN=e.target.id==="ov";}'), "console modals must remember where the pointer press began");
assert(consoleHtml.includes('MODAL_BACKDROP_DOWN&&e.target.id==="ov"'), "console modals must require press and release on the backdrop");
assert(!consoleHtml.includes('addEventListener("click",e=>{if(e.target.id==="ov")closeModal();}'), "console must not dismiss from a release-only backdrop click");

assert(landingHtml.includes("addEventListener('pointerdown',e=>{CHECKOUT_BACKDROP_DOWN=e.target.id==='cartOv';}"), "checkout must remember where the pointer press began");
assert(landingHtml.includes("CHECKOUT_BACKDROP_DOWN&&e.target.id==='cartOv'"), "checkout must require press and release on the backdrop");
assert(!landingHtml.includes("addEventListener('click',e=>{if(e.target.id==='cartOv')closeCheckout();}"), "checkout must not dismiss from a release-only backdrop click");

console.log("modal selection guard: all tests passed");
