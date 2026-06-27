package cz.fit.cvut.seatlock.es_documents;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.*;


@Getter
@Setter
@NoArgsConstructor
@Document(indexName = "performers")
public class PerformerDocument {
    @Id
    private String id;

    @MultiField(
            mainField = @Field(type = FieldType.Text, analyzer = "standard"),
            otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword)
    )
    private String name;

    public PerformerDocument(String id, String name) {
        this.id = id;
        this.name = name;
    }
}
