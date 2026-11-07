// 全ページ共通の小さな処理。CSP でインラインスクリプトを禁止しているため、ここにまとめて外部ファイルとして読み込む
(function() {
    // メニューで現在のカテゴリを強調する（カテゴリは common-head.html の meta から受け取る）
    function highlightMenu() {
        const meta = document.querySelector('meta[name="page-category"]');
        const navigation = document.getElementsByClassName("navigation")[0];
        if (!meta || !navigation) return;

        const currCategory = meta.getAttribute("content");
        for (const menuItem of navigation.getElementsByTagName("a")) {
            if (menuItem.getAttribute("category") === currCategory) {
                menuItem.classList.add("selected");
                return;
            }
        }
    }

    // 読み込めなかった画像を隠す（旧 onerror 属性の代わり）
    function hideBrokenImages() {
        document.querySelectorAll("img[data-hide-on-error]").forEach(img => {
            const hide = () => { img.style.display = "none"; };
            if (img.complete && img.naturalWidth === 0) {
                hide();
            } else {
                img.addEventListener("error", hide);
            }
        });
    }

    highlightMenu();
    hideBrokenImages();
})();
