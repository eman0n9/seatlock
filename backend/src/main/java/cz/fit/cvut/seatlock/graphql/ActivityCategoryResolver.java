package cz.fit.cvut.seatlock.graphql;

import cz.fit.cvut.seatlock.domain.ActivityCategory;
import cz.fit.cvut.seatlock.service.ActivityCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class ActivityCategoryResolver {
    private final ActivityCategoryService activityCategoryService;

    @QueryMapping
    public List<ActivityCategory> showAllCategories(){
        return activityCategoryService.showAllCategories();
    }

    @MutationMapping
    public Boolean deleteCategory(@Argument UUID id){
        return activityCategoryService.deleteCategory(id);
    }

    @MutationMapping
    public Boolean changeCategory(@Argument UUID id, @Argument String name){
        return activityCategoryService.changeCategory(id, name);
    }

    @MutationMapping
    public Boolean addCategory(@Argument String name){
        return activityCategoryService.addCategory(name);
    }
}
