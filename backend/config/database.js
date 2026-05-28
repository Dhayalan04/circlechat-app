const fs = require('fs');
const path = require('path');

// Data file paths
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CIRCLES_FILE = path.join(DATA_DIR, 'circles.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure data directory and files exist
const initializeDatabase = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const files = [
    { path: USERS_FILE, default: [] },
    { path: CIRCLES_FILE, default: [] },
    { path: MEMBERS_FILE, default: [] },
    { path: MESSAGES_FILE, default: [] }
  ];

  files.forEach(({ path: filePath, default: defaultData }) => {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
  });
};

// Read data from JSON file
const readData = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
};

// Write data to JSON file
const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error.message);
  }
};

// Initialize on load
initializeDatabase();

module.exports = {
  readData,
  writeData,
  USERS_FILE,
  CIRCLES_FILE,
  MEMBERS_FILE,
  MESSAGES_FILE,
  DATA_DIR
};
