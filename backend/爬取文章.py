import requests
from bs4 import BeautifulSoup

def get_latest_8point1kr_article():
    url = "https://www.36kr.com/search/articles/8%E7%82%B91%E6%B0%AA"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

    # 查找所有文章容器
    article_containers = soup.find_all('div', class_='kr-shadow-content')

    if article_containers:
        # 获取第一篇文章
        first_article = article_containers[0]
        
        # 提取标题和链接
        title_element = first_article.find('a', class_='article-item-title')
        title = title_element.text.strip() if title_element else "标题未找到"
        link = "https://www.36kr.com" + title_element['href'] if title_element else "链接未找到"
        
        # 提取摘要
        summary_element = first_article.find('a', class_='article-item-description')
        summary = summary_element.text.strip() if summary_element else "摘要未找到"

        # 提取发布时间
        time_element = first_article.find('span', class_='kr-flow-bar-time')
        publish_time = time_element.text.strip() if time_element else "发布时间未找到"

        article_info = {
            'title': title,
            'url': link,
            'summary': summary,
            'publish_time': publish_time
        }

        return article_info
    else:
        print("未找到文章列表")
        return None

if __name__ == "__main__":
    article = get_latest_8point1kr_article()
    if article:
        print(f"标题: {article['title']}")
        print(f"链接: {article['url']}")
        print(f"摘要: {article['summary']}")
        print(f"发布时间: {article['publish_time']}")
    else:
        print("未能获取到文章信息")