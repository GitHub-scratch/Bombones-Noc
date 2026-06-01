const {google} = require('googleapis');
const fs = require('fs');

const credentials = JSON.parse(fs.readFileSync('./bombones-noc-6913ab3e3360.json'));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });

drive.files.list({
  q: "'1HnFucJsQclKnnp7F7eC2OLaUdbEs6lA7' in parents",
  fields: 'files(id, name)'
}).then(r => {
  console.log('OK - archivos en carpeta:', r.data.files.length);
  console.log(r.data.files);
}).catch(e => {
  console.error('ERROR:', e.message);
});
