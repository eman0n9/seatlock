package cz.fit.cvut.seatlock.es_documents;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.*;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(indexName = "activities")
public class ActivityDocument {
    @Id
    private String id;

    @MultiField(
            mainField = @Field(type = FieldType.Text, analyzer = "standard"),
            otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword)
    )
    private String name;

    @Field(type = FieldType.Date)
    private LocalDate date;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String description;

    @Field(type = FieldType.Keyword)
    private String activityCategory;

    @Field(type = FieldType.Keyword)
    private String hall;

    @Field(type = FieldType.Text, analyzer = "standard")
    private List<String> performerNames;

    public ActivityDocument(String id, String name, String description, List<String> performerNames) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.performerNames = performerNames;
    }
}
