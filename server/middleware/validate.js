export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const userMessage = firstIssue?.message || 'Invalid request payload';
    return res.status(400).json({
      success: false,
      error: userMessage,
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  req.body = result.data;
  return next();
};
