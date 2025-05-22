const express   = require('express');
const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');
const app       = express();

// Serve the static HTML UI
app.use(express.static(path.join(__dirname, 'public')));

app.get('/download', (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing ?url= Spotify URL');
  }

  // Create a unique temp directory
  const tmpDir = path.join(__dirname, 'tmp', Date.now().toString());
  fs.mkdirSync(tmpDir, { recursive: true });

  // Invoke spotdl under Python 3
  const proc = spawn('python3', ['-m', 'spotdl', '--output', tmpDir, '--format', 'mp3', url]);

  let stderr = '';
  proc.stderr.on('data', data => stderr += data.toString());

  proc.on('close', code => {
    if (code !== 0) {
      console.error('spotdl error:', stderr);
      return res.status(500).send('Error: ' + stderr);
    }

    // Collect downloaded .mp3 files
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.mp3'));
    if (files.length === 0) {
      return res.status(500).send('No MP3 generated');
    }

    // If multiple tracks, zip them
    if (files.length > 1) {
      res.attachment('spotify-download.zip');
      const archiver = require('archiver');
      const archive = archiver('zip');
      archive.pipe(res);
      files.forEach(f => {
        archive.file(path.join(tmpDir, f), { name: f });
      });
      archive.finalize();
    } else {
      // Single track
      res.download(path.join(tmpDir, files[0]), files[0], err => {
        if (err) console.error(err);
      });
    }
  });
});

// Listen on the port Glitch provides
const listener = app.listen(process.env.PORT, () => {
  console.log('Listening on port ' + listener.address().port);
});
