const File = require('../models/File')

async function saveFile(data) {

  const file = await File.create({
    filename: data.filename,
    originalName: data.originalName,
    mimetype: data.mimetype,
    size: data.size,
    uploadedBy: data.uploadedBy
  })

  return file
}

module.exports = {
  saveFile
}