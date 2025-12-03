function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function blockwait(ms) {
  let now = new Date();
  while ((new Date()) - now < ms) {}
}

async function work(id, ms) {
  console.log(`working at ${id}`);
  await wait(ms);
  console.log(`working at ${id}`);
  await wait(ms);
  console.log(`working at ${id}`);
}

async function foo() {
  work(1,1400);
  work(2,200);
  console.log("esot ilin");
  blockwait(1400);
}

foo();
