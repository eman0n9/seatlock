package cz.fit.cvut.seatlock.es_documents;

import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.List;

public interface PerformerSearchRepository extends ElasticsearchRepository<PerformerDocument, String> {
    @Query("""
        {
          "match_phrase_prefix": {
            "name": "?0"
          }
        }
        """)
    List<PerformerDocument> findByName(String text);
}
