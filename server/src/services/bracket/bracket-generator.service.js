async function generateBracketStructure(athletes) {

    const shuffled = [...athletes].sort(() => Math.random() - 0.5)
  
    return shuffled
  
  }
  
  module.exports = {
    generateBracketStructure
  }