const dayjs = require('dayjs')

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function isPast(date) {
  return dayjs().isAfter(dayjs(date))
}

function isBefore(a, b) {
  return dayjs(a).isBefore(dayjs(b))
}

module.exports = {
  formatDate,
  isPast,
  isBefore
}