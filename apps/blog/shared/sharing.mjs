// Both direct HTML and client navigation use the same public sharing metadata.
export function sharingCard(article = {}, origin) {
  const image = article.sharingImage;
  return image ? { ...image, url: new URL(image.url, origin).href } : {
    url: `${origin}/static/share.png`, width: 1200, height: 630, type: 'image/png',
    alt: 'Blorenge Commoners Association — landscape, community and recovery'
  };
}
