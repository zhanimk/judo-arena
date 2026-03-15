function buildPagination(query) {
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 10
  
    const skip = (page - 1) * limit
  
    return {
      page,
      limit,
      skip
    }
  }
  
  module.exports = buildPagination