const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },

  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  }

})

const fileFilter = (req, file, cb) => {

  const allowed = ['image/jpeg', 'image/png', 'application/pdf']

  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Unsupported file type'), false)
  }

}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
})

module.exports = upload