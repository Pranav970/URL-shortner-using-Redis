const { ZodError } = require('zod');

/**
 * Creates an Express middleware that validates req.body against a Zod schema.
 * Returns 422 with structured field errors on failure.
 *
 * @param {import('zod').ZodSchema} schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
      }
      next(err);
    }
  };
}

/**
 * Validates req.query against a Zod schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
      }
      next(err);
    }
  };
}

module.exports = { validateBody, validateQuery };
