export const formatPrice = (price: string): string => {
  // Handle different currency formats
  const cleanPrice = price.replace(/[^0-9.,]/g, '');
  const number = parseFloat(cleanPrice.replace(',', ''));
  
  if (price.includes('€')) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(number);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(number);
};

export const formatDimensions = (dimensions: string): string => {
  // Standardize dimension format
  return dimensions
    .replace(/[×x]/g, ' × ')
    .replace(/\s+/g, ' ')
    .trim();
};
