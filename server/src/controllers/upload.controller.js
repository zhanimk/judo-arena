const path = require('path');

exports.getFile = (req, res) => {

  const filePath = path.join(__dirname, '../../uploads', req.params.filename);

  res.sendFile(filePath);

};