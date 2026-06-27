package cz.fit.cvut.seatlock.es_documents;

import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import java.util.List;

public interface ActivitySearchRepository extends ElasticsearchRepository<ActivityDocument, String> {
    @Query("""
    {
      "multi_match": {
        "query": "?0",
        "fields": ["name", "description", "performerNames"]
      }
    }
    """)
    List<ActivityDocument> searchByTextWithPerformers(String text);
}
