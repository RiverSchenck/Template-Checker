const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const publicDir = path.join(__dirname, '..', 'public');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('Build directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Copy manifest.json from public to build
const manifestSource = path.join(publicDir, 'manifest.json');
const manifestDest = path.join(buildDir, 'manifest.json');

// Copy background.js from public to build
const backgroundSource = path.join(publicDir, 'background.js');
const backgroundDest = path.join(buildDir, 'background.js');

if (fs.existsSync(backgroundSource)) {
  fs.copyFileSync(backgroundSource, backgroundDest);
  console.log('✓ Copied background.js');
}

if (fs.existsSync(manifestSource)) {
  fs.copyFileSync(manifestSource, manifestDest);
  console.log('✓ Copied manifest.json');
} else {
  console.error('manifest.json not found in public directory');
  process.exit(1);
}

// Copy icon files
const iconFiles = ['tech-sol48.png', 'tech-sol192.png', 'tech-sol512.png'];
iconFiles.forEach(iconFile => {
  const iconSource = path.join(publicDir, iconFile);
  const iconDest = path.join(buildDir, iconFile);

  if (fs.existsSync(iconSource)) {
    fs.copyFileSync(iconSource, iconDest);
    console.log(`✓ Copied ${iconFile}`);
  }
});

// Copy fonts directory if it exists
const fontsSource = path.join(publicDir, 'fonts');
const fontsDest = path.join(buildDir, 'fonts');

if (fs.existsSync(fontsSource)) {
  fs.mkdirSync(fontsDest, { recursive: true });
  const fontsFiles = fs.readdirSync(fontsSource);
  fontsFiles.forEach(file => {
    const fileSource = path.join(fontsSource, file);
    const fileDest = path.join(fontsDest, file);
    if (fs.statSync(fileSource).isFile()) {
      fs.copyFileSync(fileSource, fileDest);
    }
  });
  console.log('✓ Copied fonts directory');
}

// Copy content-scripts directory if it exists
const contentScriptsSource = path.join(publicDir, 'content-scripts');
const contentScriptsDest = path.join(buildDir, 'content-scripts');

if (fs.existsSync(contentScriptsSource)) {
  fs.mkdirSync(contentScriptsDest, { recursive: true });
  const contentScriptsFiles = fs.readdirSync(contentScriptsSource);
  contentScriptsFiles.forEach(file => {
    const fileSource = path.join(contentScriptsSource, file);
    const fileDest = path.join(contentScriptsDest, file);
    if (fs.statSync(fileSource).isFile()) {
      fs.copyFileSync(fileSource, fileDest);
    }
  });
  console.log('✓ Copied content-scripts directory');
}

console.log('Extension files copied successfully!');
