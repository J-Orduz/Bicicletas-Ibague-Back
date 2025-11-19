export async function getStripePublishableKey(req, res, next) {
  try {
    const pk = process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUB_KEY || '';
    if (!pk) return res.status(404).json({ error: 'Publishable key not configured' });
    return res.json({ publishableKey: pk });
  } catch (err) {
    next(err);
  }
}

export default { getStripePublishableKey };