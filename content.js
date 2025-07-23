chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    let links = new Set();

    const collectLinks = () => {
      document.querySelectorAll('.card-list-item a[href]').forEach(a => {
        links.add(a.getAttribute('href'));
      });
    };

    const clickLoadMore = setInterval(() => {
      collectLinks(); 
      const loadMoreButton = document.querySelector('a.btn.btn-secondary.btn--full-width.ng-scope[ng-click="ctrl.loadMore()"]');
      if (loadMoreButton) {
        loadMoreButton.click();
      } else {
        clearInterval(clickLoadMore);
        collectLinks();
        chrome.storage.local.set({ links: Array.from(links) }, () => {
          chrome.runtime.sendMessage({action: "scraping_complete"});
        });
      }
    }, 2000);
  }
}); 