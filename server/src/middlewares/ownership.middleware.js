module.exports = function (model, field = 'userId') {

    return async function (req, res, next) {
  
      const resource = await model.findById(req.params.id);
  
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }
  
      if (resource[field].toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Forbidden' });
      }
  
      next();
  
    };
  
  };