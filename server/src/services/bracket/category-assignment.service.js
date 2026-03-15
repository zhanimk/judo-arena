function resolveCategory(athlete, categories) {

    return categories.find(cat =>
      athlete.gender === cat.gender &&
      athlete.weight <= cat.maxWeight
    )
  
  }
  
  module.exports = {
    resolveCategory
  }