document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startScraping');
  const navigateLinksBtn = document.getElementById('navigateLinksBtn');
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');
  const linksContainer = document.getElementById('linksContainer');

  // Set to track unique rows based on all fields
  const seenRows = new Set();

  startBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "start"});
    });
  });

  navigateLinksBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "navigate_links"});
  });

  downloadCsvBtn.addEventListener('click', () => {
    chrome.storage.local.get('scrapedData', (data) => {
      if (data.scrapedData) {
        downloadFile(convertToCSV(data.scrapedData), 'bws_data.csv', 'text/csv');
      }
    });
  });

  downloadJsonBtn.addEventListener('click', () => {
    chrome.storage.local.get('scrapedData', (data) => {
      if (data.scrapedData) {
        downloadFile(JSON.stringify(data.scrapedData, null, 2), 'bws_data.json', 'application/json');
      }
    });
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scraping_complete") {
      startBtn.style.display = 'none';

      chrome.storage.local.get('links', (data) => {
        if (data.links && data.links.length > 0) {
          linksContainer.innerHTML = '';
          data.links.forEach(link => {
            const a = document.createElement('a');
            a.href = `https://bws.com.au${link}`;
            a.textContent = `https://bws.com.au${link}`;
            a.target = '_blank';
            linksContainer.appendChild(a);
          });
          navigateLinksBtn.style.display = 'block';
          chrome.runtime.sendMessage({action: "navigate_links"});
        }
      });
    }
    if (request.action === "scraped_data") {
      // Process new scraped data and avoid duplicates
      chrome.storage.local.get('scrapedData', (data) => {
        let scrapedData = data.scrapedData || [];
        const newProduct = request.data;

        // Check each packaging option to avoid duplicates
        const newRows = [];
        newProduct.packagingOptions.forEach(option => {
          const rowKey = [
            newProduct.productId || '',
            newProduct.productUrl || '',
            newProduct.imageUrl || '',
            newProduct.name || '',
            newProduct.brand || '',
            newProduct.style || '',
            newProduct.abv || '',
            newProduct.description || '',
            newProduct.rating || '',
            newProduct.review || '',
            option.bundle || '',
            option.stock || '',
            option.nonMemberPrice || '',
            option.promoPrice || '',
            option.discountPrice || '',
            option.memberPrice || ''
          ].join('|');

          if (!seenRows.has(rowKey)) {
            seenRows.add(rowKey);
            newRows.push({ ...newProduct, packagingOptions: [option] });
          }
        });

        // Merge non-duplicate rows
        if (newRows.length > 0) {
          // Check if product exists, update packaging options if necessary
          const existingProductIndex = scrapedData.findIndex(p => p.productId === newProduct.productId);
          if (existingProductIndex !== -1) {
            // Update existing product with new non-duplicate packaging options
            newRows.forEach(newRow => {
              const existingOption = scrapedData[existingProductIndex].packagingOptions.find(
                opt => opt.bundle === newRow.packagingOptions[0].bundle
              );
              if (!existingOption) {
                scrapedData[existingProductIndex].packagingOptions.push(newRow.packagingOptions[0]);
              }
            });
          } else {
            // Add new product with non-duplicate packaging options
            scrapedData.push({
              ...newProduct,
              packagingOptions: newRows.map(row => row.packagingOptions[0])
            });
          }

          chrome.storage.local.set({ scrapedData }, () => {
            console.log('Data saved:', scrapedData);
            downloadCsvBtn.style.display = 'block';
            downloadJsonBtn.style.display = 'block';
            chrome.runtime.sendMessage({ action: "data_updated" });
          });
        }
      });
    }
    if (request.action === "data_updated") {
      downloadCsvBtn.style.display = 'block';
      downloadJsonBtn.style.display = 'block';
    }
  });

  function convertToCSV(data) {
    const csvRows = [];
    const headers = [
      'Product ID', 'Product URL', 'Image URL', 'Name', 'Brand', 'Style', 'ABV', 
      'Description', 'Rating', 'Review', 'Bundle', 'Stock', 'Non-Member Price', 
      'Promo Price', 'Discount Price', 'Member Price'
    ];
    
    csvRows.push(headers.join(','));

    // Helper function to properly escape CSV fields
    function escapeCSVField(field) {
      if (field === null || field === undefined) {
        return '';
      }
      
      let stringField = String(field);
      stringField = stringField.replace(/"/g, '""');
      if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('\r') || stringField.includes('"')) {
        return `"${stringField}"`;
      }
      
      return stringField;
    }

    data.forEach(product => {
      if (product.packagingOptions && product.packagingOptions.length > 0) {
        product.packagingOptions.forEach(option => {
          const row = [
            product.productId || '',
            product.productUrl || '',
            product.imageUrl || '',
            product.name || '',
            product.brand || '',
            product.style || '',
            product.abv || '',
            product.description || '',
            product.rating || '',
            product.review || '',
            option.bundle || '',
            option.stock || '',
            option.nonMemberPrice || '',
            option.promoPrice || '',
            option.discountPrice || '',
            option.memberPrice || ''
          ];
          csvRows.push(row.map(field => escapeCSVField(field)).join(','));
        });
      } else {
        const row = [
          product.productId || '',
          product.productUrl || '',
          product.imageUrl || '',
          product.name || '',
          product.brand || '',
          product.style || '',
          product.abv || '',
          product.description || '',
          product.rating || '',
          product.review || '',
          '',
          '',
          '',
          '',
          '',
          ''
        ];
        csvRows.push(row.map(field => escapeCSVField(field)).join(','));
      }
    });

    return csvRows.join('\n');
  }

  function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  }
});