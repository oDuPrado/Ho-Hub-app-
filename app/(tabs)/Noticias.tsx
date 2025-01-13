import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import axios from "axios";
import * as WebBrowser from "expo-web-browser";

import { useTranslation } from "react-i18next"; // <--- i18n

interface NewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
  image: string | null;
  description: string;
}

export default function NoticiasScreen() {
  const { t } = useTranslation(); // <--- i18n
  const [loading, setLoading] = useState<boolean>(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [errorLog, setErrorLog] = useState<string>("");

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    setErrorLog("");
    try {
      const fetchedNews = await fetchNewsAPINews();
      if (fetchedNews.length === 0) {
        setErrorLog(t("noticias.no_news"));
      }
      setNews(fetchedNews);
    } catch (error) {
      console.log("Erro ao buscar notícias:", error);
      setErrorLog(t("noticias.error"));
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      Alert.alert(t("common.error"), t("noticias.details.link_error"));
      console.error("Erro ao abrir link:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t("noticias.header")}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 20 }} />
      ) : errorLog ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{errorLog}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNews}>
            <Text style={styles.retryButtonText}>{t("noticias.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.newsList}>
          {news.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={() => handleOpenLink(item.link)}
            >
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.cardImage} />
              )}
              <Text style={styles.title}>
                {item.title || t("noticias.details.no_title")}
              </Text>
              {item.description && (
                <Text style={styles.description}>
                  {item.description || t("noticias.details.no_description")}
                </Text>
              )}
              <Text style={styles.date}>
                {t("noticias.details.date")}: {item.date}
              </Text>
              <Text style={styles.source}>
                {t("noticias.details.source")}: {item.source}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

async function fetchNewsAPINews(): Promise<NewsItem[]> {
  const apiKey = "847216195ee642f684ee6f39c627a58d";
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);
  const fromDate = oneMonthAgo.toISOString().split("T")[0];
  const toDate = today.toISOString().split("T")[0];

  const url = `https://newsapi.org/v2/everything?q=Pokemon%20TCG&from=${fromDate}&to=${toDate}&sortBy=publishedAt&language=en&pageSize=20&apiKey=${apiKey}`;
  console.log("Requisitando a URL:", url);

  try {
    const response = await axios.get(url);
    if (response.status !== 200) {
      throw new Error(`Status de Erro: ${response.status}`);
    }

    const articles = response.data.articles || [];
    const mapped = articles.map((article: any) => {
      return {
        title: article.title || "",
        link: article.url || "#",
        date: new Date(article.publishedAt || "").toLocaleDateString(),
        source: article.source?.name || "NewsAPI",
        image: article.urlToImage || null,
        description: article.description || "",
      } as NewsItem;
    });
    return mapped;
  } catch (error) {
    console.error("Erro ao buscar notícias da NewsAPI:", error);
    throw error;
  }
}

const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const CARD_BG = "#292929";
const BORDER = "#4D4D4D";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    padding: 16,
  },
  header: {
    color: "#FFD700",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  errorContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  errorMessage: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  newsList: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  title: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  description: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 5,
  },
  date: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 5,
  },
  source: {
    color: "#FFF",
    fontSize: 14,
  },
});
