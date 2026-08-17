package com.margins.reflectionloop.model.dto.response;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReflectionInterviewResponse {
    Long interviewId;
    Long parentInterviewId;
    Long forkQuestionId;
    Long reflectionId;
    Long sourceRevisionId;
    String status;
    Integer answeredCount;
    Integer skippedCount;
    Integer generatedCount;
    Integer minimumAnswers;
    Integer targetAnswers;
    Integer maximumQuestions;
    List<String> coverage;
    List<InterviewAnswerDto> answers;
    InterviewQuestionDto currentQuestion;
    boolean canGenerateGuide;
    boolean maxReached;
    Long guideId;
}
