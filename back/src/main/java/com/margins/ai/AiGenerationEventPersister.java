package com.margins.ai;

import com.margins.ai.mapper.AiGenerationEventMapper;
import com.margins.ai.model.AiGenerationEventRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps observability writes isolated from the product transaction that triggered generation.
 */
@Component
@RequiredArgsConstructor
public class AiGenerationEventPersister {
    private final AiGenerationEventMapper mapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persist(AiGenerationEventRecord event) {
        mapper.insert(event);
    }
}
