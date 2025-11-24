const fs = require('fs');
const readline = require('readline');

async function checkLine() {
  const fileStream = fs.createReadStream('./data/allRestaurant.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('三犬西餐廳')) {
      console.log(`Line ${lineCount}: Found by includes('三犬西餐廳')`);
      console.log(line);
      break;
    }
    // Also check if we can find it by the garbage name if possible, but hard to type.
    // Let's just print lines 15-17
    if (lineCount >= 15 && lineCount <= 17) {
        console.log(`Line ${lineCount} (raw):`, line);
    }
  }
}

checkLine();