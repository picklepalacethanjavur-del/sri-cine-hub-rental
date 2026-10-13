const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('console.html', 'utf8');
const source = html.split('/* ============ desktop date calendar ============ */')[1].split('/* ============ end desktop date calendar ============ */')[0];
const listeners = {};
let desktop = true, dialog;
const document = {
  body: {appendChild() {}},
  addEventListener(type, fn) {listeners[type] = fn;},
  createElement() {
    dialog = {open:false,innerHTML:'',listeners:{},setAttribute(){},
      addEventListener(type, fn) {this.listeners[type] = fn;},
      showModal() {this.open=true;},close() {this.open=false;},
      querySelector() {return {focus(){}};},
      getBoundingClientRect() {return {left:0,right:300,top:0,bottom:300};}};
    return dialog;
  }
};
const context = vm.createContext({document,window:{matchMedia:()=>({get matches(){return desktop;}})},
  Event:class {constructor(type,opts){this.type=type;this.bubbles=opts.bubbles;}},
  parseD:s=>new Date(s+'T00:00:00')});
vm.runInContext(source,context);
function field(value='',props={}) {
  return {value, min:'',max:'',disabled:false,readOnly:false,required:false,isConnected:true,
    events:[],focus(){this.focused=true;},matches(){return true;},closest(){return this;},
    dispatchEvent(e){this.events.push(e);if(this.onchange&&e.type==='change')this.onchange();},...props};
}
function click(input) {const e={target:input,preventDefault(){this.prevented=true;}};listeners.click(e);return e;}
function choose(value) {context.selectedDate=value;vm.runInContext('chooseCalendarDate(selectedDate)',context);}
const start=field('2026-10-13');
assert(click(start).prevented);
assert(dialog.open, 'Clicking any part of a desktop date field opens a calendar');
assert(dialog.innerHTML.includes('October 2026'));
assert(dialog.innerHTML.includes('data-date="2026-10-13" aria-label="13 October 2026" aria-pressed="true"'));
choose('2026-10-15');
assert.equal(start.value,'2026-10-15');
assert.deepEqual(start.events.map(e=>e.type),['input','change']);
assert(start.events.every(e=>e.bubbles));
assert(!dialog.open);
assert(start.focused);
const end=field('');let bookingEnd='';end.onchange=()=>{bookingEnd=end.value;};
click(end);choose('2026-10-17');assert.equal(bookingEnd,'2026-10-17','Existing form handlers receive the selected date');
click(end);choose('2026-10-17');assert.equal(end.events.length,2,'Selecting the same date causes no duplicate changes');
click(end);choose('');assert.equal(bookingEnd,'');
const bounded=field('2026-10-13',{min:'2026-10-12',max:'2026-10-15'});
click(bounded);choose('2026-10-16');assert.equal(bounded.value,'2026-10-13');assert(dialog.open);
assert(dialog.innerHTML.includes('aria-label="16 October 2026" aria-pressed="false" disabled'));
choose('2026-10-12');assert.equal(bounded.value,'2026-10-12');
const yearEnd=field('2026-12-31');click(yearEnd);
const next={disabled:false,dataset:{month:'1'}};
dialog.listeners.click({target:{closest:()=>next}});
assert(dialog.innerHTML.includes('January 2027'),'Month navigation crosses year boundaries');
const esc={key:'Escape',target:yearEnd,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
listeners.keydown(esc);assert(esc.prevented&&esc.stopped&&!dialog.open,'Escape must not reach the parent Return modal');
const keyboard={key:'ArrowDown',altKey:true,target:start,preventDefault(){this.prevented=true;}};
listeners.keydown(keyboard);assert(keyboard.prevented&&dialog.open);
vm.runInContext('closeDateCalendar()',context);
assert(!click(field('',{disabled:true})).prevented);
assert(!click(field('',{readOnly:true})).prevented);
desktop=false;
assert(!click(start).prevented,'Touch/mobile keeps the native picker');assert(!dialog.open);
desktop=true;
const detached=field('2026-10-13');click(detached);detached.isConnected=false;choose('2026-10-15');
assert.equal(detached.value,'2026-10-13');assert(!dialog.open);
console.log('desktop calendar: all tests passed');
