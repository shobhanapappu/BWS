const scrapeProductDetails = async () => {
  const brandElement = document.querySelector('.detail-item_brand span[itemprop="name"]');
  const controlsElement = document.querySelector('#product-detail-contols-cart');
  const detailsElement = document.querySelector('.product-additional-details_container');

  // Check if all required elements are present
  if (!brandElement || !controlsElement || !detailsElement) {
    // Retry after a delay if elements are not found
    setTimeout(scrapeProductDetails, 500);
    return;
  }

  try {
    const getText = (selector, parent = document) => {
      try {
        return parent.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || null;
      } catch (e) {
        console.error(`Error getting text for selector: ${selector}`, e);
        return null;
      }
    };

    const getAttribute = (selector, attribute, parent = document) => {
      try {
        return parent.querySelector(selector)?.getAttribute(attribute) || null;
      } catch (e) {
        console.error(`Error getting attribute for selector: ${selector}`, e);
        return null;
      }
    };

    // Get basic product info
    const brand = getText('.detail-item_brand span[itemprop="name"]');
    const title = getText('.detail-item_title');
    const fullName = brand && title ? `${brand} ${title}` : (title || brand);
    const imageUrl = getAttribute('.product-detail-slick-item img', 'src');
    const description = getText('p[itemprop="description"]');

    // Get product URL
    const productUrl = window.location.href;

    // Get product ID from URL or other source
    const productId = productUrl.match(/\/product\/(\d+)\//)?.[1] || '';

    // Get awards
    let awards = '';
    try {
      const awardElement = document.querySelector('div[ng-if*="awardwinner"] p');
      if (awardElement) {
        awards = awardElement.innerText.replace("Awards Won", "").replace(/\s+/g, ' ').trim();
      }
    } catch (e) {
      console.error('Error getting awards', e);
    }

    // Get additional details
    const additionalDetails = {};
    try {
      document.querySelectorAll('.list--details_item').forEach(item => {
        const keyRaw = getText('.list-details_header', item);
        if (keyRaw) {
          const key = keyRaw.replace(/\s/g, '');
          const value = getText('.list-details_info', item);
          if (key && value && key.toLowerCase() !== 'brand') {
            additionalDetails[key] = value;
          }
        }
      });
    } catch (e) {
      console.error('Error getting additional details', e);
    }

    // Get review info
    let overallRating = '';
    let reviewCount = '';
    try {
      const productRatingElement = document.querySelector('.productTile_rating .star-rating .sr-only span.ng-binding');
      if (productRatingElement) {
        overallRating = productRatingElement.textContent.trim();
      }

      if (!overallRating) {
        const srOnlyElements = document.querySelectorAll('.sr-only span.ng-binding');
        for (let element of srOnlyElements) {
          const parentText = element.parentElement?.textContent || '';
          if (parentText.includes('Average rating:')) {
            overallRating = element.textContent.trim();
            break;
          }
        }
      }

      const reviewCountElement = document.querySelector('.rating_count.ng-binding');
      if (reviewCountElement) {
        const countText = reviewCountElement.textContent.trim();
        const countMatch = countText.match(/\((\d+)\)|^(\d+)$/);
        reviewCount = countMatch ? (countMatch[1] || countMatch[2]) : countText;
      }

      if (!overallRating || !reviewCount) {
        const reviewElement = document.querySelector('.review-overview-rating');
        if (reviewElement) {
          if (!overallRating) {
            const reviewRatingElement = reviewElement.querySelector('.star-rating .sr-only span.ng-binding');
            if (reviewRatingElement) {
              overallRating = reviewRatingElement.textContent.trim();
            }
          }
          if (!reviewCount) {
            const reviewSummary = getText('.review-overview-summary') || '';
            const reviewMatch = reviewSummary.match(/\((\d+)\/\d+\)/);
            reviewCount = reviewMatch ? reviewMatch[1] : '';
          }
        }
      }
    } catch (e) {
      console.error('Error getting review details', e);
    }

    // Get packaging options with pricing
    const packagingOptions = [];
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const volumeElements = document.querySelectorAll('.trolley-controls_volume');
      console.log(`Found ${volumeElements.length} packaging options`);

      if (volumeElements.length === 0) {
        console.log('No volume elements found, trying alternative selectors...');
        const altElements = document.querySelectorAll('[ng-repeat*="product in productCollection.Products"]');
        console.log(`Found ${altElements.length} alternative elements`);
      }

      volumeElements.forEach((optionNode, index) => {
        try {
          console.log(`Processing packaging option ${index + 1}`);
          let bundle = getText('.trolley-controls_volume_title', optionNode) ||
                       getText('.volume_title', optionNode) ||
                       getText('[ng-bind*="title"]', optionNode) ||
                       getText('[ng-bind*="name"]', optionNode);
      
          let priceDollars = getText('.trolley-controls_volume_price--dollars', optionNode) ||
                            getText('.price--dollars', optionNode) ||
                            getText('[ng-bind*="dollars"]', optionNode) ||
                            getText('.price-dollars', optionNode);
      
          let priceCents = getText('.trolley-controls_volume_price--cents', optionNode) ||
                           getText('.price--cents', optionNode) ||
                           getText('[ng-bind*="cents"]', optionNode) ||
                           getText('.price-cents', optionNode);
      
          let priceSign = getText('.trolley-controls_volume_price--dollarsign', optionNode) ||
                          getText('.price--dollarsign', optionNode) ||
                          getText('.dollarsign', optionNode) || '$';
      
          if (!bundle || !priceDollars) {
            console.log('Trying to extract from all text content...');
            const allText = optionNode.textContent.trim();
            const priceMatch = allText.match(/\$(\d+)(?:\.(\d{2}))?/);
            if (priceMatch && !priceDollars) {
              priceDollars = priceMatch[1];
              priceCents = priceMatch[2] || '00';
              priceSign = '$';
            }
      
            if (!bundle) {
              const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
              for (let line of lines) {
                if (line.includes('ml') || line.includes('Pack') || line.includes('Can') || line.includes('Bottle') || line.includes('Case')) {
                  bundle = line;
                  break;
                }
              }
            }
          }
      
          if (bundle && priceDollars) {
            let fullPrice = priceDollars;
            if (priceCents && priceCents !== '00') {
              fullPrice = `${priceDollars}.${priceCents}`;
            } else {
              fullPrice = `${priceDollars}.00`;
            }
            const nonMemberPrice = `${priceSign || '$'}${fullPrice}`;
      
            let promoPrice = '';
            let memberPrice = '';
            try {
              const promoElement = optionNode.querySelector('.trolley-controls_volume_promo');
              if (promoElement) {
                promoPrice = getText('.trolley-controls_volume_promo', optionNode) || '';
                // Check if promoPrice contains "on app for"
                if (promoPrice.toLowerCase().includes('on app for')) {
                  memberPrice = promoPrice; // Assign to memberPrice
                  promoPrice = ''; // Clear promoPrice
                }
              }
            } catch (e) {
              console.error('Error getting promo price', e);
            }
      
            if (!promoPrice) {
              try {
                const promoBadge = document.querySelector('percentage-off-badge');
                if (promoBadge) {
                  const topText = getText('.badge_top-text', promoBadge) || '';
                  const subtitleText = getText('.badge_subtitle', promoBadge) || '';
                  const bottomText = getText('.badge_bottom-text', promoBadge) || '';
                  let promoParts = [];
                  if (topText) promoParts.push(topText);
                  if (subtitleText) promoParts.push(subtitleText);
                  if (bottomText) promoParts.push(bottomText);
                  if (promoParts.length > 0) {
                    promoPrice = promoParts.join(' ').trim();
                    // Check again for "on app for" in case promoPrice comes from badge
                    if (promoPrice.toLowerCase().includes('on app for')) {
                      memberPrice = promoPrice;
                      promoPrice = '';
                    }
                  }
                }
              } catch (e) {
                console.error('Error getting promotional badge price', e);
              }
            }
      
            let adjustedNonMemberPrice = nonMemberPrice;
            let discountPrice = '';
            let savingsAmount = '';
      
            try {
              const savingsBadge = document.querySelector('savings-badge .badge_subtitle');
              if (savingsBadge) {
                const fullText = savingsBadge.textContent.trim();
                const numberMatch = fullText.replace('$', '').match(/(\d+)(\d{2})?/);
                if (numberMatch) {
                  const allDigits = numberMatch[0];
                  if (allDigits.length <= 2) {
                    savingsAmount = `${allDigits}.00`;
                  } else if (allDigits.length === 3) {
                    const dollars = allDigits.substring(0, 1);
                    const cents = allDigits.substring(1);
                    savingsAmount = `${dollars}.${cents}`;
                  } else if (allDigits.length >= 4) {
                    const dollars = allDigits.substring(0, allDigits.length - 2);
                    const cents = allDigits.substring(allDigits.length - 2);
                    savingsAmount = `${dollars}.${cents}`;
                  }
      
                  if (savingsAmount) {
                    const currentPrice = parseFloat(fullPrice);
                    const savings = parseFloat(savingsAmount);
                    if (!isNaN(currentPrice) && !isNaN(savings)) {
                      discountPrice = nonMemberPrice;
                      adjustedNonMemberPrice = `${priceSign || ''}${(currentPrice + savings).toFixed(2)}`;
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error getting savings badge', e);
            }
      
            try {
              const memberElement = optionNode.querySelector('.trolley-controls_volume_member-price');
              if (memberElement && !memberPrice) { // Only overwrite if memberPrice wasn't set by promoPrice
                memberPrice = getText('.trolley-controls_volume_member-price', optionNode) || '';
              }
      
              if (!discountPrice) {
                const discountElement = optionNode.querySelector('.trolley-controls_volume_discount-price');
                if (discountElement) {
                  discountPrice = getText('.trolley-controls_volume_discount-price', optionNode) || '';
                }
              }
            } catch (e) {
              console.error('Error getting member/discount price', e);
            }
      
            let stock = '';
            try {
              const stockElement = optionNode.querySelector('.stock-status');
              if (stockElement) {
                stock = getText('.stock-status', optionNode) || '';
              }
              if (!stock) {
                stock = getText('[ng-bind*="stock"]', optionNode) ||
                       getText('.availability', optionNode) ||
                       getText('.stock', optionNode) || '';
              }
            } catch (e) {
              console.error('Error getting stock status', e);
            }
      
            packagingOptions.push({
              bundle: bundle.replace(/\s+/g, ' ').trim(),
              stock: stock,
              nonMemberPrice: adjustedNonMemberPrice,
              promoPrice: promoPrice,
              discountPrice: discountPrice,
              memberPrice: memberPrice
            });
          }
        } catch (optionError) {
          console.error(`Error processing packaging option ${index + 1}:`, optionError);
        }
      });

      if (packagingOptions.length === 0) {
        console.log('No packaging options found, trying fallback extraction...');
        try {
          const priceElements = document.querySelectorAll('[class*="price"], [ng-bind*="price"], [ng-bind*="dollars"]');
          const mainPrice = getText('.product-price .price') ||
                           getText('[ng-bind*="currentPrice"]') ||
                           getText('.current-price');
          if (mainPrice) {
            packagingOptions.push({
              bundle: getText('.detail-item_title') || 'Single Item',
              stock: 'Available',
              nonMemberPrice: mainPrice,
              promoPrice: '',
              discountPrice: '',
              memberPrice: ''
            });
          }
        } catch (fallbackError) {
          console.error('Fallback extraction failed:', fallbackError);
        }
      }
    } catch (e) {
      console.error('Error scraping packaging options', e);
    }

    // Create the product data object
    const productData = {
      productId: productId,
      productUrl: productUrl,
      imageUrl: imageUrl,
      name: fullName,
      brand: brand,
      style: additionalDetails.BeerType || additionalDetails.LiquorStyle || '',
      abv: additionalDetails['Alcohol%'] || '',
      description: description,
      rating: overallRating,
      review: reviewCount,
      ibu: additionalDetails.IBU || '',
      additionalDetails: additionalDetails,
      packagingOptions: packagingOptions
    };

    console.log('Final product data:', productData);
    chrome.runtime.sendMessage({ action: "scraped_data", data: productData });
  } catch (error) {
    console.error("Error scraping product details:", error);
    chrome.runtime.sendMessage({ action: "scraping_error", error: error.message });
  }
};

// Initial call to start scraping
scrapeProductDetails();